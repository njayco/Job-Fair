import { getStripeSync, getUncachableStripeClient } from './stripeClient.js';
import pool from './db.js';

/**
 * Handle checkout.session.completed — ensure customer ID is linked to user account
 */
async function handleCheckoutSessionCompleted(event) {
  const session = event.data.object;
  const customerId = session.customer;
  if (!customerId) return;

  // If not yet linked by ID, try linking by email
  const existing = await pool.query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );
  if (existing.rows.length === 0 && session.customer_email) {
    await pool.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE email = $2 AND stripe_customer_id IS NULL',
      [customerId, session.customer_email]
    );
  }

  console.log(`checkout.session.completed: customer ${customerId} linked`);
}

/**
 * Handle customer.subscription.deleted — subscription cancelled or expired.
 * stripe-replit-sync updates stripe.subscriptions status; we log for audit.
 */
async function handleSubscriptionDeleted(event) {
  const subscription = event.data.object;
  console.log(`customer.subscription.deleted: sub ${subscription.id} customer ${subscription.customer}`);
}

/**
 * Handle invoice.payment_failed — payment failure.
 * stripe-replit-sync marks subscription past_due; we log for audit.
 */
async function handleInvoicePaymentFailed(event) {
  const invoice = event.data.object;
  console.log(`invoice.payment_failed: invoice ${invoice.id} customer ${invoice.customer}`);
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

    // stripe-replit-sync handles schema sync for all events
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Additionally handle app-level lifecycle events
    // Parse the event using the Stripe SDK for type safety
    const stripe = await getUncachableStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      // Signature verification failure — log and let sync result stand
      console.error('Stripe webhook signature verification failed:', err.message);
      return;
    }

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
        // All other events handled by stripe-replit-sync schema sync only
        break;
    }

    console.log(`Webhook processed: ${event.type} (${event.id})`);
  }
}
