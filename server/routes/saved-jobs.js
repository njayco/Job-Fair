import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, job_finder_run_id, role, company, url, match_pct, notes, created_at
       FROM saved_jobs
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ saved_jobs: result.rows });
  } catch (err) {
    console.error('GET /api/saved-jobs error:', err);
    res.status(500).json({ error: 'Failed to fetch saved jobs.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { job_finder_run_id: rawRunId, role, company, url, match_pct, notes } = req.body;
    if (!role || !company) {
      return res.status(400).json({ error: 'role and company are required.' });
    }

    // Validate job_finder_run_id belongs to this user before trusting it
    let safeRunId = null;
    if (rawRunId != null) {
      const check = await pool.query(
        'SELECT id FROM job_finder_runs WHERE id = $1 AND user_id = $2',
        [rawRunId, req.user.id]
      );
      if (check.rows.length) safeRunId = rawRunId;
    }

    // Upsert: return existing row if same (user_id, role, company, url) already saved
    const result = await pool.query(
      `INSERT INTO saved_jobs (user_id, job_finder_run_id, role, company, url, match_pct, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, role, company, url)
         DO UPDATE SET match_pct = EXCLUDED.match_pct, job_finder_run_id = COALESCE(EXCLUDED.job_finder_run_id, saved_jobs.job_finder_run_id)
       RETURNING id, job_finder_run_id, role, company, url, match_pct, notes, created_at`,
      [req.user.id, safeRunId, role, company, url ?? null, match_pct ?? null, notes ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/saved-jobs error:', err);
    res.status(500).json({ error: 'Failed to save job.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM saved_jobs WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Saved job not found.' });
    }
    res.json({ deleted: true, id: Number(req.params.id) });
  } catch (err) {
    console.error('DELETE /api/saved-jobs/:id error:', err);
    res.status(500).json({ error: 'Failed to delete saved job.' });
  }
});

export default router;
