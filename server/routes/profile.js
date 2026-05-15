import { Router } from 'express';
import multer from 'multer';
import pool from '../db.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/profile — return text profile fields (no avatar bytes)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, account_type, is_admin, created_at,
              first_name, last_name, desired_occupation, industry, location, interests,
              (avatar IS NOT NULL) AS has_avatar
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/profile — update text profile fields
router.put('/', async (req, res) => {
  try {
    const { first_name, last_name, desired_occupation, industry, location, interests } = req.body;
    const { rows } = await pool.query(
      `UPDATE users
       SET first_name = $1, last_name = $2, desired_occupation = $3,
           industry = $4, location = $5, interests = $6
       WHERE id = $7
       RETURNING id, email, account_type, is_admin, created_at,
                 first_name, last_name, desired_occupation, industry, location, interests,
                 (avatar IS NOT NULL) AS has_avatar`,
      [
        first_name?.trim() || null,
        last_name?.trim() || null,
        desired_occupation?.trim() || null,
        industry?.trim() || null,
        location?.trim() || null,
        interests?.trim() || null,
        req.user.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /api/profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/profile/avatar — upload avatar image
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' });
    }
    await pool.query(
      'UPDATE users SET avatar = $1, avatar_mimetype = $2 WHERE id = $3',
      [req.file.buffer, req.file.mimetype, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/profile/avatar error:', err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// GET /api/profile/avatar — stream avatar bytes
router.get('/avatar', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT avatar, avatar_mimetype FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length || !rows[0].avatar) {
      return res.status(404).json({ error: 'No avatar set' });
    }
    res.setHeader('Content-Type', rows[0].avatar_mimetype || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(rows[0].avatar);
  } catch (err) {
    console.error('GET /api/profile/avatar error:', err);
    res.status(500).json({ error: 'Failed to fetch avatar' });
  }
});

export default router;
