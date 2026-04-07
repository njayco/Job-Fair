import { Router } from 'express';
import { getStripePublishableKey } from '../stripeClient.js';
import pool from '../db.js';

const router = Router();

// Fallback Pro plan price used when stripe.prices is unavailable (e.g., during sync delay).
// Set PRO_PRICE_ID env var to the Stripe price ID if you want a hard-coded fallback.
const FALLBACK_PRO_PRICE_ID = process.env.PRO_PRICE_ID || null;
const FALLBACK_PRICE = FALLBACK_PRO_PRICE_ID ? [{
  price_id: FALLBACK_PRO_PRICE_ID,
  unit_amount: 1900,
  currency: 'usd',
  recurring: { interval: 'month', interval_count: 1 },
  product_id: null,
  product_name: 'Career-Ops Pro',
  product_description: 'Unlimited AI evaluations + PDF generation. Cancel anytime.',
}] : [];

// GET /api/billing/prices — public, no auth required (used on pricing page)
router.get('/prices', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id AS price_id,
        p.unit_amount,
        p.currency,
        p.recurring,
        p.product AS product_id,
        pr.name AS product_name,
        pr.description AS product_description
      FROM stripe.prices p
      JOIN stripe.products pr ON pr.id = p.product
      WHERE p.active = true
        AND pr.active = true
        AND p.unit_amount IS NOT NULL
      ORDER BY p.unit_amount ASC
    `);

    // If the sync table has prices, return them; otherwise fall back to env-configured price
    if (result.rows.length > 0) {
      return res.json({ prices: result.rows });
    }

    return res.json({ prices: FALLBACK_PRICE });
  } catch {
    // stripe schema not ready yet — fall back gracefully
    return res.json({ prices: FALLBACK_PRICE });
  }
});

// GET /api/billing/publishable-key — public, no auth required
router.get('/publishable-key', async (req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (err) {
    console.error('GET /api/billing/publishable-key error:', err);
    res.status(500).json({ error: 'Failed to get publishable key' });
  }
});

export default router;
