import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/employer/jobs — list this employer's jobs (most recent first)
router.get('/jobs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.id, j.title, j.description_text, j.created_at,
              COUNT(c.id)::int AS candidate_count,
              ROUND(AVG(c.match_score))::int AS avg_score
       FROM employer_jobs j
       LEFT JOIN employer_candidates c ON c.job_id = j.id
       WHERE j.user_id = $1
       GROUP BY j.id
       ORDER BY j.created_at DESC`,
      [req.user.id]
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    console.error('GET /api/employer/jobs error:', err);
    res.status(500).json({ error: 'Failed to fetch jobs.' });
  }
});

// POST /api/employer/jobs — create a new job
router.post('/jobs', async (req, res) => {
  try {
    const { title, description_text } = req.body;
    if (!description_text || description_text.trim().length < 20) {
      return res.status(400).json({ error: 'Job description is required.' });
    }
    const result = await pool.query(
      `INSERT INTO employer_jobs (user_id, title, description_text)
       VALUES ($1, $2, $3)
       RETURNING id, title, description_text, created_at`,
      [req.user.id, (title || '').trim() || 'Untitled Role', description_text.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/employer/jobs error:', err);
    res.status(500).json({ error: 'Failed to create job.' });
  }
});

// GET /api/employer/jobs/:id — get one job with its candidates
router.get('/jobs/:id', async (req, res) => {
  try {
    const jobResult = await pool.query(
      'SELECT * FROM employer_jobs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!jobResult.rows.length) return res.status(404).json({ error: 'Job not found.' });

    const candidatesResult = await pool.query(
      `SELECT id, filename, parsed_name, parsed_email, parsed_phone, parsed_employer,
              match_score, status, evaluation_json->>'recommendation' AS recommendation,
              evaluation_json->>'summary' AS summary, created_at
       FROM employer_candidates
       WHERE job_id = $1
       ORDER BY match_score DESC NULLS LAST, created_at ASC`,
      [req.params.id]
    );

    res.json({ job: jobResult.rows[0], candidates: candidatesResult.rows });
  } catch (err) {
    console.error('GET /api/employer/jobs/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch job.' });
  }
});

// DELETE /api/employer/jobs/:id — delete job and its candidates
router.delete('/jobs/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM employer_jobs WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Job not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/employer/jobs/:id error:', err);
    res.status(500).json({ error: 'Failed to delete job.' });
  }
});

export default router;
