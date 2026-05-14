import { Router } from 'express';
import pool from '../db.js';
import { inspectForm } from '../lib/formInspector.js';
import { draftApplicationAnswers } from '../lib/applyDrafter.js';

const router = Router();

// POST /api/apply/prepare
// Body: { application_id }
// Returns: { attempt_id, url, company, role, fields, detection_type, detection_error }
router.post('/prepare', async (req, res) => {
  const { application_id } = req.body;
  const userId = req.user.id;

  if (!application_id) {
    return res.status(400).json({ error: 'application_id is required' });
  }

  try {
    // Fetch the application (scoped to user)
    const { rows: appRows } = await pool.query(
      `SELECT id, company, role, url, evaluation_json
       FROM applications WHERE id = $1 AND user_id = $2`,
      [application_id, userId]
    );
    if (!appRows.length) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const app = appRows[0];

    if (!app.url) {
      return res.status(400).json({
        error: 'This application has no URL. Add a job URL first.',
        error_type: 'NO_URL',
      });
    }

    // Fetch user's CV
    const { rows: cvRows } = await pool.query(
      'SELECT content_md FROM cvs WHERE user_id = $1',
      [userId]
    );
    const cvContent = cvRows[0]?.content_md || '';

    if (!cvContent.trim()) {
      return res.status(400).json({
        error: 'No saved CV found. Save your CV on the Account page first.',
        error_type: 'NO_CV',
      });
    }

    // Inspect the form
    let inspectResult;
    try {
      inspectResult = await inspectForm(app.url);
    } catch (err) {
      console.warn('[apply/prepare] Form inspection failed:', err.message);
      inspectResult = { fields: [], detectionType: 'fallback', error: 'FETCH_ERROR' };
    }

    const { fields, detectionType, error: detectionError } = inspectResult;

    // Draft answers with Claude
    let draftedFields;
    try {
      draftedFields = await draftApplicationAnswers({
        fields,
        cvContent,
        evaluationJson: app.evaluation_json,
        company: app.company,
        role: app.role,
        jobUrl: app.url,
      });
    } catch (err) {
      console.error('[apply/prepare] Claude drafting failed:', err.message);
      // Return fields without proposed values rather than failing entirely
      draftedFields = fields.map(f => ({ ...f, proposed_value: '', approved_value: '' }));
    }

    // Persist the attempt
    const { rows: attemptRows } = await pool.query(
      `INSERT INTO apply_attempts (user_id, application_id, url, fields_json, status)
       VALUES ($1, $2, $3, $4, 'drafted')
       RETURNING id, created_at`,
      [userId, application_id, app.url, JSON.stringify(draftedFields)]
    );
    const attempt = attemptRows[0];

    res.json({
      attempt_id: attempt.id,
      application_id,
      url: app.url,
      company: app.company,
      role: app.role,
      fields: draftedFields,
      detection_type: detectionType,
      detection_error: detectionError,
      created_at: attempt.created_at,
    });
  } catch (err) {
    console.error('[apply/prepare] Error:', err);
    res.status(500).json({ error: err.message || 'Preparation failed' });
  }
});

// POST /api/apply/fill
// Body: { attempt_id, fields: [{ label, name, type, selector, proposed_value, approved_value }] }
// Saves approved field values and marks attempt as filled
router.post('/fill', async (req, res) => {
  const { attempt_id, fields } = req.body;
  const userId = req.user.id;

  if (!attempt_id) {
    return res.status(400).json({ error: 'attempt_id is required' });
  }

  try {
    // Verify ownership
    const { rows } = await pool.query(
      'SELECT id, url, application_id FROM apply_attempts WHERE id = $1 AND user_id = $2',
      [attempt_id, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Apply attempt not found' });
    }
    const attempt = rows[0];

    // Save approved values and mark as filled
    await pool.query(
      `UPDATE apply_attempts
       SET fields_json = $1, status = 'filled', updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(fields || []), attempt_id]
    );

    res.json({
      ok: true,
      attempt_id,
      application_id: attempt.application_id,
      url: attempt.url,
      status: 'filled',
    });
  } catch (err) {
    console.error('[apply/fill] Error:', err);
    res.status(500).json({ error: err.message || 'Fill failed' });
  }
});

// GET /api/apply/attempts/:applicationId
// Returns all attempts for a given application
router.get('/attempts/:applicationId', async (req, res) => {
  const applicationId = parseInt(req.params.applicationId, 10);
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT id, status, created_at, updated_at,
              jsonb_array_length(fields_json) AS field_count
       FROM apply_attempts
       WHERE application_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [applicationId, userId]
    );
    res.json({ attempts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/apply/attempts/:applicationId/:attemptId
// Returns full attempt with all fields
router.get('/attempts/:applicationId/:attemptId', async (req, res) => {
  const attemptId = parseInt(req.params.attemptId, 10);
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT a.*, ap.url AS app_url, ap.company, ap.role
       FROM apply_attempts a
       JOIN applications ap ON ap.id = a.application_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [attemptId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Attempt not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
