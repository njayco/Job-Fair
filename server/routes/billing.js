import { Router } from 'express';
import pool from '../db.js';
import { getUncachableStripeClient } from '../stripeClient.js';

const router = Router();

function getBaseUrl(req) {
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
  if (domain) return `https://${domain}`;
  return `${req.protocol}://${req.get('host')}`;
}

async function getOrCreateCustomer(userId, email) {
  const { rows } = await pool.query(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );
  if (rows[0]?.stripe_customer_id) return rows[0].stripe_customer_id;

  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: { userId: String(userId) },
  });

  await pool.query(
    'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
    [customer.id, userId]
  );

  return customer.id;
}

async function getUserPlan(userId) {
  const { rows } = await pool.query(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) return { plan: 'free', status: null, subscription: null };

  try {
    const subResult = await pool.query(
      `SELECT s.id, s.status, s.current_period_end, s.cancel_at_period_end
       FROM stripe.subscriptions s
       WHERE s.customer = $1
         AND s.status IN ('active', 'trialing')
       ORDER BY s.created DESC
       LIMIT 1`,
      [customerId]
    );

    if (subResult.rows.length > 0) {
      const sub = subResult.rows[0];
      return { plan: 'pro', status: sub.status, subscription: sub };
    }
  } catch {
    // stripe schema not ready yet or no subscriptions
  }

  return { plan: 'free', status: null, subscription: null };
}

// GET /api/billing/status — current plan + usage
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan, status, subscription } = await getUserPlan(userId);

    const month = new Date().toISOString().slice(0, 7);
    const usageResult = await pool.query(
      'SELECT evaluation_count FROM usage WHERE user_id = $1 AND month = $2',
      [userId, month]
    );
    const usageCount = usageResult.rows[0]?.evaluation_count || 0;

    const FREE_LIMIT = parseInt(process.env.FREE_EVAL_LIMIT || '3', 10);

    res.json({
      plan,
      status,
      usageCount,
      freeLimit: FREE_LIMIT,
      limitReached: plan === 'free' && usageCount >= FREE_LIMIT,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
      } : null,
    });
  } catch (err) {
    console.error('GET /api/billing/status error:', err);
    res.status(500).json({ error: 'Failed to get billing status' });
  }
});

// POST /api/billing/checkout — create Stripe Checkout session
// priceId is validated server-side against our own active prices in the DB
router.post('/checkout', async (req, res) => {
  try {
    const userId = req.user.id;
    const { priceId } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'priceId is required' });
    }

    // Validate priceId against our own active prices to prevent tampering
    const priceCheck = await pool.query(
      `SELECT p.id FROM stripe.prices p
       JOIN stripe.products pr ON pr.id = p.product
       WHERE p.id = $1 AND p.active = true AND pr.active = true`,
      [priceId]
    );
    if (priceCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid price ID' });
    }

    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const email = userResult.rows[0]?.email;
    const customerId = await getOrCreateCustomer(userId, email);

    const stripe = await getUncachableStripeClient();
    const base = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${base}/billing?success=1`,
      cancel_url: `${base}/pricing?cancelled=1`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('POST /api/billing/checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/billing/portal — open Stripe billing portal
router.post('/portal', async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    const customerId = userResult.rows[0]?.stripe_customer_id;

    if (!customerId) {
      return res.status(400).json({ error: 'No billing account found. Please subscribe first.' });
    }

    const stripe = await getUncachableStripeClient();
    const base = getBaseUrl(req);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('POST /api/billing/portal error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

export default router;
