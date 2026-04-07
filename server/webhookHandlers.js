import { getStripeSync, getUncachableStripeClient } from './stripeClient.js';
import pool from './db.js';

/**
 * Handle checkout.session.completed — activate customer record
 */
async function handleCheckoutSessionCompleted(event) {
  const session = event.data.object;
  const customerId = session.customer;
  if (!customerId) return;

  // Ensure the customer ID is linked in our users table if we know this customer
  const existing = await pool.query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );
  if (existing.rows.length === 0 && session.customer_email) {
    // Associate customer with user account by email
    await pool.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE email = $2 AND stripe_customer_id IS NULL',
      [customerId, session.customer_email]
    );
  }

  console.log(`checkout.session.completed for customer ${customerId}`);
}

/**
 * Handle customer.subscription.deleted — subscription cancelled/expired
 * The stripe.subscriptions table will be updated by stripe-replit-sync.
 * We log the event for audit purposes.
 */
async function handleSubscriptionDeleted(event) {
  const subscription = event.data.object;
  console.log(`customer.subscription.deleted: sub ${subscription.id} for customer ${subscription.customer}`);
}

/**
 * Handle invoice.payment_failed — payment failure notification
 * stripe-replit-sync updates stripe.subscriptions status to 'past_due'.
 * We log and can extend with email notification hooks.
 */
async function handleInvoicePaymentFailed(event) {
  const invoice = event.data.object;
  console.log(`invoice.payment_failed: invoice ${invoice.id} for customer ${invoice.customer}`);
}

export class WebhookHandlers {
  static async processWebhook(payload, signature) {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // Let stripe-replit-sync handle schema sync for all events
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Additionally parse and handle app-level lifecycle events
    try {
      const stripe = await getUncachableStripeClient();
      const event = stripe.webhooks.constructEventAsyncCallback
        ? await stripe.webhooks.constructEventAsync(payload, signature, process.env.STRIPE_WEBHOOK_SECRET || '')
        : stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET || '');

      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event);
          break;
        default:
          // Event handled by stripe-replit-sync schema sync only
          break;
      }
    } catch {
      // Signature verification failures or unknown events are already caught by sync.processWebhook
    }

    console.log(`Received webhook ${payload.length} bytes`);
  }
}
