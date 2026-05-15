import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db.js';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../lib/authMiddleware.js';

const router = Router();
const BCRYPT_ROUNDS = 12;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const account_type = req.body.account_type === 'employer' ? 'employer' : 'employee';
    const adminEmail = (process.env.ADMIN_USER || '').toLowerCase();
    const is_admin = adminEmail && email.toLowerCase() === adminEmail;
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, account_type, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, account_type, is_admin, created_at,
                 first_name, last_name, desired_occupation, industry, location, interests,
                 (avatar IS NOT NULL) AS has_avatar`,
      [email.toLowerCase(), password_hash, account_type, is_admin]
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, email: user.email, account_type: user.account_type });
    setAuthCookie(res, token);

    res.status(201).json({
      id: user.id,
      email: user.email,
      account_type: user.account_type,
      is_admin: user.is_admin,
      created_at: user.created_at,
      first_name: user.first_name,
      last_name: user.last_name,
      desired_occupation: user.desired_occupation,
      industry: user.industry,
      location: user.location,
      interests: user.interests,
      has_avatar: user.has_avatar,
    });
  } catch (err) {
    console.error('POST /api/auth/signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, account_type, is_admin FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Ensure admin flag is correct for the admin email (fixes existing accounts)
    const adminEmail = (process.env.ADMIN_USER || '').toLowerCase();
    if (adminEmail && user.email === adminEmail && !user.is_admin) {
      await pool.query('UPDATE users SET is_admin = TRUE WHERE id = $1', [user.id]);
      user.is_admin = true;
    }

    const token = signToken({ id: user.id, email: user.email, account_type: user.account_type });
    setAuthCookie(res, token);

    // Fetch full profile fields so login response matches /me shape
    const full = await pool.query(
      `SELECT id, email, account_type, is_admin, created_at,
              first_name, last_name, desired_occupation, industry, location, interests,
              (avatar IS NOT NULL) AS has_avatar
       FROM users WHERE id = $1`,
      [user.id]
    );
    res.json(full.rows[0]);
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me — returns the current session user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, account_type, is_admin, created_at,
              first_name, last_name, desired_occupation, industry, location, interests,
              (avatar IS NOT NULL) AS has_avatar
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
