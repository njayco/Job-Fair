import { Router } from 'express';
import { getStripePublishableKey } from '../stripeClient.js';
import pool from '../db.js';

const router = Router();

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
    res.json({ prices: result.rows });
  } catch (err) {
    console.error('GET /api/billing/prices error:', err);
    res.status(500).json({ error: 'Failed to load pricing' });
  }
});

// GET /api/billing/publishable-key — public, no auth required
router.get('/publishable-key', async (req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get publishable key' });
  }
});

export default router;
