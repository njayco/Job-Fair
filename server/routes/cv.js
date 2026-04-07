import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/cv
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT content_md, updated_at FROM cvs WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ content_md: null, updated_at: null });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/cv error:', err);
    res.status(500).json({ error: 'Failed to fetch CV', details: err.message });
  }
});

// PUT /api/cv
router.put('/', async (req, res) => {
  try {
    const { content_md } = req.body;

    if (!content_md) {
      return res.status(400).json({ error: 'content_md is required' });
    }

    const userId = req.user.id;

    const result = await pool.query(
      `INSERT INTO cvs (user_id, content_md)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET content_md = $2, updated_at = NOW()
       RETURNING content_md, updated_at`,
      [userId, content_md]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/cv error:', err);
    res.status(500).json({ error: 'Failed to save CV', details: err.message });
  }
});

export default router;
