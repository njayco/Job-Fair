import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// requireAdmin — re-checks is_admin from DB on every request so toggling the
// flag takes effect without the admin needing to log out and back in.
async function requireAdmin(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length || !rows[0].is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [usersRes, viewsRes, views7dRes, referrersRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                                 AS total,
          COUNT(*) FILTER (WHERE account_type = 'employee')       AS employees,
          COUNT(*) FILTER (WHERE account_type = 'employer')       AS employers
        FROM users
      `),
      pool.query('SELECT COUNT(*) AS total FROM page_views'),
      pool.query(`
        SELECT COUNT(*) AS total FROM page_views
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
      pool.query(`
        SELECT
          COALESCE(NULLIF(referrer, ''), '(direct)') AS referrer,
          COUNT(*)                                   AS count,
          MAX(created_at)                            AS last_seen
        FROM page_views
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 20
      `),
    ]);

    const u = usersRes.rows[0];
    res.json({
      totalUsers:   parseInt(u.total,     10),
      employees:    parseInt(u.employees, 10),
      employers:    parseInt(u.employers, 10),
      totalViews:   parseInt(viewsRes.rows[0].total,   10),
      views7d:      parseInt(views7dRes.rows[0].total, 10),
      topReferrers: referrersRes.rows.map(r => ({
        referrer:  r.referrer,
        count:     parseInt(r.count, 10),
        lastSeen:  r.last_seen,
      })),
    });
  } catch (err) {
    console.error('GET /api/admin/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/recent-signups
router.get('/recent-signups', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, email, account_type, is_admin, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json({ users: rows });
  } catch (err) {
    console.error('GET /api/admin/recent-signups error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
