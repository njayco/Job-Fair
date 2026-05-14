import { Router } from 'express';
import multer from 'multer';
import pool from '../db.js';
import { parseResume, extractContactInfo } from '../lib/resumeParser.js';
import { anthropicClient, MODEL } from '../lib/evaluation.js';

const router = Router();

// ── Role guard ───────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  if (req.user?.account_type !== 'employer') {
    return res.status(403).json({ error: 'Employer account required.' });
  }
  next();
});

// Multer: memory storage, max 10 MB per file, max 20 files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (allowed.includes(file.mimetype) || ['pdf','docx','txt'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.originalname}. Please use PDF, DOCX, or TXT.`));
    }
  },
});

// ── Job CRUD ─────────────────────────────────────────────────────────────────

// GET /api/employer/jobs
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

// POST /api/employer/jobs
router.post('/jobs', async (req, res) => {
  try {
    const { title, description_text } = req.body;
    if (!description_text || description_text.trim().length < 20) {
      return res.status(400).json({ error: 'Job description is required (min 20 characters).' });
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

// GET /api/employer/jobs/:id
router.get('/jobs/:id', async (req, res) => {
  try {
    const jobResult = await pool.query(
      'SELECT * FROM employer_jobs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!jobResult.rows.length) return res.status(404).json({ error: 'Job not found.' });

    const candidatesResult = await pool.query(
      `SELECT id, filename, parsed_name, parsed_email, parsed_phone, parsed_employer,
              match_score, status,
              evaluation_json->>'recommendation' AS recommendation,
              evaluation_json->>'summary' AS summary,
              evaluation_json->'strengths' AS strengths,
              evaluation_json->'gaps' AS gaps,
              evaluation_json->>'seniority' AS seniority,
              (evaluation_json->>'comp_low')::numeric AS comp_low,
              (evaluation_json->>'comp_high')::numeric AS comp_high,
              created_at
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

// DELETE /api/employer/jobs/:id
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

// ── Candidate endpoints ───────────────────────────────────────────────────────

// GET /api/employer/jobs/:id/candidates
router.get('/jobs/:id/candidates', async (req, res) => {
  try {
    const jobCheck = await pool.query(
      'SELECT id FROM employer_jobs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!jobCheck.rows.length) return res.status(404).json({ error: 'Job not found.' });

    const result = await pool.query(
      `SELECT id, filename, parsed_name, parsed_email, parsed_phone, parsed_employer,
              match_score, status,
              evaluation_json->>'recommendation' AS recommendation,
              evaluation_json->>'summary' AS summary,
              evaluation_json->'strengths' AS strengths,
              evaluation_json->'gaps' AS gaps,
              evaluation_json->>'seniority' AS seniority,
              (evaluation_json->>'comp_low')::numeric AS comp_low,
              (evaluation_json->>'comp_high')::numeric AS comp_high,
              created_at
       FROM employer_candidates
       WHERE job_id = $1
       ORDER BY match_score DESC NULLS LAST, created_at ASC`,
      [req.params.id]
    );
    res.json({ candidates: result.rows });
  } catch (err) {
    console.error('GET /api/employer/jobs/:id/candidates error:', err);
    res.status(500).json({ error: 'Failed to fetch candidates.' });
  }
});

// POST /api/employer/jobs/:id/candidates/upload
router.post('/jobs/:id/candidates/upload', upload.array('resumes', 20), async (req, res) => {
  try {
    const jobResult = await pool.query(
      'SELECT id FROM employer_jobs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!jobResult.rows.length) return res.status(404).json({ error: 'Job not found.' });

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No files uploaded.' });

    const inserted = [];
    const errors = [];

    for (const file of files) {
      try {
        const { text } = await parseResume(file.buffer, file.mimetype, file.originalname);
        const contact = extractContactInfo(text);

        const row = await pool.query(
          `INSERT INTO employer_candidates
             (job_id, filename, resume_text, parsed_name, parsed_email, parsed_phone, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'Uploaded')
           RETURNING id, filename, parsed_name, parsed_email, parsed_phone, status, created_at`,
          [req.params.id, file.originalname, text, contact.parsed_name, contact.parsed_email, contact.parsed_phone]
        );
        if (row.rows.length) inserted.push(row.rows[0]);
      } catch (fileErr) {
        errors.push({ filename: file.originalname, error: fileErr.message });
      }
    }

    res.json({ uploaded: inserted.length, candidates: inserted, errors });
  } catch (err) {
    console.error('POST /api/employer/jobs/:id/candidates/upload error:', err);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

// POST /api/employer/jobs/:id/evaluate
router.post('/jobs/:id/evaluate', async (req, res) => {
  try {
    const jobResult = await pool.query(
      'SELECT id, title, description_text FROM employer_jobs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!jobResult.rows.length) return res.status(404).json({ error: 'Job not found.' });
    const job = jobResult.rows[0];

    const candidateRows = await pool.query(
      `SELECT id, filename, parsed_name, resume_text
       FROM employer_candidates
       WHERE job_id = $1 AND status = 'Uploaded'
       ORDER BY created_at ASC
       LIMIT 20`,
      [req.params.id]
    );
    const candidates = candidateRows.rows;

    if (!candidates.length) {
      return res.status(400).json({ error: 'No uploaded candidates to evaluate.' });
    }

    // Build batch prompt
    const candidateBlocks = candidates.map((c, i) =>
      `--- CANDIDATE ${i + 1} ---\nFilename: ${c.filename}\nName hint: ${c.parsed_name || 'Unknown'}\n\nRESUME TEXT:\n${(c.resume_text || '').slice(0, 4000)}`
    ).join('\n\n');

    const prompt = `You are an expert technical recruiter. Score each candidate resume against the job description below.

JOB TITLE: ${job.title}

JOB DESCRIPTION:
${job.description_text}

CANDIDATES (${candidates.length} total):
${candidateBlocks}

Return a valid JSON array of exactly ${candidates.length} objects, one per candidate in order:
[
  {
    "index": 1,
    "name": "full name or best guess from resume",
    "email": "extracted email or null",
    "phone": "extracted phone or null",
    "current_employer": "most recent employer or null",
    "match_score": 0-100,
    "strengths": ["3 specific bullets about why they fit this role"],
    "gaps": ["1-2 honest gaps vs the JD"],
    "seniority": "junior|mid|senior|principal",
    "comp_low": annual USD integer or null,
    "comp_high": annual USD integer or null,
    "recommendation": "Strong Hire|Hire|Consider|Weak Match|Do Not Proceed",
    "summary": "2-3 sentence executive overview of this candidate vs the role"
  }
]

Respond with ONLY the JSON array, no markdown fences, no commentary.`;

    const message = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0]?.text || '';
    const jsonText = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    let scores;
    try {
      scores = JSON.parse(jsonText);
    } catch {
      console.error('Claude returned invalid JSON:', raw.slice(0, 500));
      return res.status(502).json({ error: 'AI returned invalid response. Please try again.' });
    }

    if (!Array.isArray(scores) || scores.length !== candidates.length) {
      return res.status(502).json({ error: 'AI returned unexpected structure. Please try again.' });
    }

    // Update each candidate in DB
    const VALID_RECS = ['Strong Hire', 'Hire', 'Consider', 'Weak Match', 'Do Not Proceed'];
    const VALID_SENIORITY = ['junior', 'mid', 'senior', 'principal'];
    const updatedCandidates = [];
    for (let i = 0; i < candidates.length; i++) {
      const s = scores[i] ?? {};
      // Coerce and validate fields to prevent partial/malformed updates
      const matchScore = typeof s.match_score === 'number' ? Math.round(Math.min(100, Math.max(0, s.match_score))) : null;
      const recommendation = VALID_RECS.includes(s.recommendation) ? s.recommendation : 'Consider';
      const seniority = VALID_SENIORITY.includes(s.seniority) ? s.seniority : null;
      const compLow = typeof s.comp_low === 'number' ? Math.round(s.comp_low) : null;
      const compHigh = typeof s.comp_high === 'number' ? Math.round(s.comp_high) : null;
      const strengths = Array.isArray(s.strengths) ? s.strengths.filter(x => typeof x === 'string') : [];
      const gaps = Array.isArray(s.gaps) ? s.gaps.filter(x => typeof x === 'string') : [];
      const summary = typeof s.summary === 'string' ? s.summary : '';
      const evalJson = {
        recommendation,
        summary,
        strengths,
        gaps,
        seniority,
        comp_low: compLow,
        comp_high: compHigh,
      };
      const row = await pool.query(
        `UPDATE employer_candidates
         SET match_score = $1,
             parsed_name = COALESCE(NULLIF($2,''), parsed_name),
             parsed_email = COALESCE(NULLIF($3,''), parsed_email),
             parsed_phone = COALESCE(NULLIF($4,''), parsed_phone),
             parsed_employer = $5,
             evaluation_json = $6,
             status = 'Evaluated'
         WHERE id = $7
         RETURNING id, filename, parsed_name, parsed_email, parsed_phone, parsed_employer,
                   match_score, status,
                   evaluation_json->>'recommendation' AS recommendation,
                   evaluation_json->>'summary' AS summary,
                   evaluation_json->'strengths' AS strengths,
                   evaluation_json->'gaps' AS gaps,
                   evaluation_json->>'seniority' AS seniority,
                   (evaluation_json->>'comp_low')::numeric AS comp_low,
                   (evaluation_json->>'comp_high')::numeric AS comp_high,
                   created_at`,
        [
          matchScore,
          s.name ?? null,
          s.email ?? null,
          s.phone ?? null,
          s.current_employer ?? null,
          JSON.stringify(evalJson),
          candidates[i].id,
        ]
      );
      if (row.rows.length) updatedCandidates.push(row.rows[0]);
    }

    // Return the full candidate list for this job (not just the batch) sorted by score desc
    const allCandidates = await pool.query(
      `SELECT id, filename, parsed_name, parsed_email, parsed_phone, parsed_employer,
              match_score, status,
              evaluation_json->>'recommendation' AS recommendation,
              evaluation_json->>'summary' AS summary,
              evaluation_json->'strengths' AS strengths,
              evaluation_json->'gaps' AS gaps,
              evaluation_json->>'seniority' AS seniority,
              (evaluation_json->>'comp_low')::numeric AS comp_low,
              (evaluation_json->>'comp_high')::numeric AS comp_high,
              created_at
       FROM employer_candidates
       WHERE job_id = $1
       ORDER BY match_score DESC NULLS LAST, created_at ASC`,
      [req.params.id]
    );
    res.json({ evaluated: updatedCandidates.length, candidates: allCandidates.rows });
  } catch (err) {
    console.error('POST /api/employer/jobs/:id/evaluate error:', err);
    res.status(500).json({ error: 'Evaluation failed: ' + err.message });
  }
});

// PATCH /api/employer/jobs/:id/candidates/:cid
router.patch('/jobs/:id/candidates/:cid', async (req, res) => {
  try {
    const jobCheck = await pool.query(
      'SELECT id FROM employer_jobs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!jobCheck.rows.length) return res.status(404).json({ error: 'Job not found.' });

    const { status } = req.body;
    const VALID_STATUSES = ['Uploaded', 'Evaluated', 'Interviewing', 'Offer', 'Hired', 'Rejected'];
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const result = await pool.query(
      `UPDATE employer_candidates
       SET status = COALESCE($1, status)
       WHERE id = $2 AND job_id = $3
       RETURNING id, filename, parsed_name, parsed_email, parsed_phone, parsed_employer,
                 match_score, status,
                 evaluation_json->>'recommendation' AS recommendation,
                 evaluation_json->>'summary' AS summary,
                 evaluation_json->'strengths' AS strengths,
                 evaluation_json->'gaps' AS gaps,
                 evaluation_json->>'seniority' AS seniority,
                 (evaluation_json->>'comp_low')::numeric AS comp_low,
                 (evaluation_json->>'comp_high')::numeric AS comp_high,
                 created_at`,
      [status || null, req.params.cid, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Candidate not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/employer/jobs/:id/candidates/:cid error:', err);
    res.status(500).json({ error: 'Failed to update candidate.' });
  }
});

// GET /api/employer/pipeline
router.get('/pipeline', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.filename, c.parsed_name, c.parsed_email, c.parsed_phone, c.parsed_employer,
              c.match_score, c.status, c.created_at,
              c.evaluation_json->>'recommendation' AS recommendation,
              c.evaluation_json->>'summary' AS summary,
              c.evaluation_json->'strengths' AS strengths,
              c.evaluation_json->'gaps' AS gaps,
              c.evaluation_json->>'seniority' AS seniority,
              (c.evaluation_json->>'comp_low')::numeric AS comp_low,
              (c.evaluation_json->>'comp_high')::numeric AS comp_high,
              j.id AS job_id, j.title AS job_title
       FROM employer_candidates c
       JOIN employer_jobs j ON c.job_id = j.id
       WHERE j.user_id = $1
       ORDER BY c.match_score DESC NULLS LAST, c.created_at ASC`,
      [req.user.id]
    );
    res.json({ candidates: result.rows });
  } catch (err) {
    console.error('GET /api/employer/pipeline error:', err);
    res.status(500).json({ error: 'Failed to fetch pipeline.' });
  }
});

// GET /api/employer/jobs/:id/candidates/:cid
router.get('/jobs/:id/candidates/:cid', async (req, res) => {
  try {
    const jobCheck = await pool.query(
      'SELECT id, title, description_text FROM employer_jobs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!jobCheck.rows.length) return res.status(404).json({ error: 'Job not found.' });

    const result = await pool.query(
      `SELECT id, filename, parsed_name, parsed_email, parsed_phone, parsed_employer,
              match_score, status, evaluation_json, created_at
       FROM employer_candidates
       WHERE id = $1 AND job_id = $2`,
      [req.params.cid, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Candidate not found.' });

    res.json({ candidate: result.rows[0], job: jobCheck.rows[0] });
  } catch (err) {
    console.error('GET /api/employer/jobs/:id/candidates/:cid error:', err);
    res.status(500).json({ error: 'Failed to fetch candidate.' });
  }
});

// POST /api/employer/jobs/:id/candidates/:cid/interview-questions
router.post('/jobs/:id/candidates/:cid/interview-questions', async (req, res) => {
  try {
    const jobCheck = await pool.query(
      'SELECT id, title, description_text FROM employer_jobs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!jobCheck.rows.length) return res.status(404).json({ error: 'Job not found.' });
    const job = jobCheck.rows[0];

    const candResult = await pool.query(
      `SELECT id, parsed_name, resume_text, evaluation_json
       FROM employer_candidates WHERE id = $1 AND job_id = $2`,
      [req.params.cid, req.params.id]
    );
    if (!candResult.rows.length) return res.status(404).json({ error: 'Candidate not found.' });
    const cand = candResult.rows[0];
    const evalData = cand.evaluation_json || {};

    const prompt = `You are a senior technical interviewer. Generate 10 personalised interview questions for this candidate applying for the role below.

ROLE: ${job.title}

JOB DESCRIPTION (excerpt):
${(job.description_text || '').slice(0, 2000)}

CANDIDATE: ${cand.parsed_name || 'Unknown'}
RECOMMENDATION: ${evalData.recommendation || '—'}
STRENGTHS: ${(evalData.strengths || []).join('; ')}
GAPS: ${(evalData.gaps || []).join('; ')}
SUMMARY: ${evalData.summary || ''}

RESUME EXCERPT:
${(cand.resume_text || '').slice(0, 3000)}

Generate exactly 10 personalised questions probing their specific background, addressing identified gaps, and revealing leadership potential.
Return a valid JSON array of exactly 10 objects:
[
  {
    "question": "The interview question",
    "rationale": "Why this question matters for this specific candidate and role"
  }
]
Respond with ONLY the JSON array, no markdown fences, no commentary.`;

    const message = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0]?.text || '';
    const jsonText = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    let questions;
    try {
      questions = JSON.parse(jsonText);
    } catch {
      return res.status(502).json({ error: 'AI returned invalid response. Please try again.' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(502).json({ error: 'AI returned unexpected structure. Please try again.' });
    }

    const cleaned = questions.slice(0, 10).map(q => ({
      question: typeof q.question === 'string' ? q.question : '',
      rationale: typeof q.rationale === 'string' ? q.rationale : '',
    })).filter(q => q.question);

    const updatedJson = { ...(cand.evaluation_json || {}), interview_questions: cleaned };
    await pool.query(
      'UPDATE employer_candidates SET evaluation_json = $1 WHERE id = $2',
      [JSON.stringify(updatedJson), cand.id]
    );

    res.json({ questions: cleaned });
  } catch (err) {
    console.error('POST /jobs/:id/candidates/:cid/interview-questions error:', err);
    res.status(500).json({ error: 'Failed to generate interview questions.' });
  }
});

// Multer error handler — converts multer errors into clean JSON responses
router.use((err, req, res, next) => {
  if (err && err.code && err.code.startsWith('LIMIT_')) {
    return res.status(400).json({ error: `Upload limit exceeded: ${err.message}` });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Upload error.' });
  }
  next();
});

export default router;
