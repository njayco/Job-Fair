import { Router } from 'express';
import pool from '../db.js';
import { inspectForm } from '../lib/formInspector.js';
import { draftApplicationAnswers, tailorResume, generateCoverLetter } from '../lib/applyDrafter.js';
import { validateAndResolveUrl } from '../lib/evaluation.js';

const router = Router();

// POST /api/apply/prepare
// Body: { application_id }
// Returns: { attempt_id, url, company, role, fields, detection_type, detection_error,
//            tailored_resume, cover_letter }
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

    // SSRF protection: validate the stored URL resolves to a public, non-private IP
    try {
      await validateAndResolveUrl(app.url);
    } catch (err) {
      return res.status(400).json({
        error: err.message,
        error_type: 'INVALID_URL',
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

    const { company, role, url, evaluation_json: evaluationJson } = app;
    const docContext = { cvContent, evaluationJson, company, role, jobUrl: url };

    // ── Phase 1: run form inspection + resume tailoring + cover letter in parallel ──
    // Field drafting depends on inspection result, so inspection is on the critical path.
    // Resume tailoring and cover letter are independent — start them immediately.
    const [inspectSettled, tailoredResumeSettled, coverLetterSettled] = await Promise.allSettled([
      inspectForm(url),
      tailorResume(docContext),
      generateCoverLetter(docContext),
    ]);

    // Unpack inspection
    let inspectResult;
    if (inspectSettled.status === 'fulfilled') {
      inspectResult = inspectSettled.value;
    } else {
      console.warn('[apply/prepare] Form inspection failed:', inspectSettled.reason?.message);
      inspectResult = { fields: [], detectionType: 'fallback', error: 'FETCH_ERROR' };
    }
    const { fields, detectionType, error: detectionError } = inspectResult;

    // Unpack documents (non-fatal if they fail)
    const tailoredResumeText = tailoredResumeSettled.status === 'fulfilled'
      ? tailoredResumeSettled.value
      : '';
    const coverLetterText = coverLetterSettled.status === 'fulfilled'
      ? coverLetterSettled.value
      : '';

    if (tailoredResumeSettled.status === 'rejected') {
      console.warn('[apply/prepare] Resume tailoring failed:', tailoredResumeSettled.reason?.message);
    }
    if (coverLetterSettled.status === 'rejected') {
      console.warn('[apply/prepare] Cover letter failed:', coverLetterSettled.reason?.message);
    }

    // ── Phase 2: draft field answers (depends on inspection result) ──
    let draftedFields;
    try {
      draftedFields = await draftApplicationAnswers({
        fields,
        cvContent,
        evaluationJson,
        company,
        role,
        jobUrl: url,
      });
    } catch (err) {
      console.error('[apply/prepare] Claude field drafting failed:', err.message);
      draftedFields = fields.map(f => ({ ...f, proposed_value: '', approved_value: '' }));
    }

    // Persist the attempt (with documents)
    const { rows: attemptRows } = await pool.query(
      `INSERT INTO apply_attempts
         (user_id, application_id, url, fields_json, tailored_resume, cover_letter, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'drafted')
       RETURNING id, created_at`,
      [userId, application_id, url, JSON.stringify(draftedFields), tailoredResumeText || null, coverLetterText || null]
    );
    const attempt = attemptRows[0];

    res.json({
      attempt_id: attempt.id,
      application_id,
      url,
      company,
      role,
      fields: draftedFields,
      detection_type: detectionType,
      detection_error: detectionError,
      tailored_resume: tailoredResumeText,
      cover_letter: coverLetterText,
      created_at: attempt.created_at,
    });
  } catch (err) {
    console.error('[apply/prepare] Error:', err);
    res.status(500).json({ error: err.message || 'Preparation failed' });
  }
});

// POST /api/apply/fill
// Body: { attempt_id, fields, tailored_resume?, cover_letter? }
// Saves approved field values + user-edited documents; marks attempt as filled
router.post('/fill', async (req, res) => {
  const { attempt_id, fields, tailored_resume, cover_letter } = req.body;
  const userId = req.user.id;

  if (!attempt_id) {
    return res.status(400).json({ error: 'attempt_id is required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, url, application_id FROM apply_attempts WHERE id = $1 AND user_id = $2',
      [attempt_id, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Apply attempt not found' });
    }
    const attempt = rows[0];

    await pool.query(
      `UPDATE apply_attempts
       SET fields_json     = $1,
           tailored_resume = COALESCE($2, tailored_resume),
           cover_letter    = COALESCE($3, cover_letter),
           status          = 'filled',
           updated_at      = NOW()
       WHERE id = $4`,
      [JSON.stringify(fields || []), tailored_resume ?? null, cover_letter ?? null, attempt_id]
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
// Returns all attempts for a given application (summary, no full fields)
router.get('/attempts/:applicationId', async (req, res) => {
  const applicationId = parseInt(req.params.applicationId, 10);
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT id, status, created_at, updated_at,
              jsonb_array_length(fields_json) AS field_count,
              (tailored_resume IS NOT NULL) AS has_tailored_resume,
              (cover_letter IS NOT NULL)    AS has_cover_letter
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
// Returns full attempt with all fields + documents
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

// DELETE /api/apply/attempts/:applicationId/:attemptId
router.delete('/attempts/:applicationId/:attemptId', async (req, res) => {
  const attemptId = parseInt(req.params.attemptId, 10);
  const applicationId = parseInt(req.params.applicationId, 10);
  const userId = req.user.id;

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM apply_attempts
       WHERE id = $1 AND application_id = $2 AND user_id = $3`,
      [attemptId, applicationId, userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Attempt not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
