import { Router } from 'express';
import { evaluateJob, fetchJobDescription, generateReportMarkdown } from '../lib/evaluation.js';
import pool from '../db.js';

const router = Router();

// POST /api/evaluate
// Body: { job_description?, job_url?, cv_content }
// Accepts EITHER job_description (raw text) OR job_url (will be fetched), or both.
// cv_content is always required.
router.post('/', async (req, res) => {
  try {
    let { job_description, job_url, cv_content } = req.body;

    const userId = req.user.id;

    if (!cv_content) {
      return res.status(400).json({
        error: 'cv_content is required. Paste your CV in markdown format.',
      });
    }

    if (!job_description && !job_url) {
      return res.status(400).json({
        error: 'Either job_description (text) or job_url is required.',
      });
    }

    // If only a URL was provided, fetch the job description from it
    if (!job_description && job_url) {
      try {
        job_description = await fetchJobDescription(job_url);
      } catch (fetchErr) {
        return res.status(422).json({
          error: `Could not fetch job description from URL: ${fetchErr.message}`,
          hint: 'Try pasting the job description text directly instead.',
        });
      }
    }

    if (job_description.trim().length < 50) {
      return res.status(400).json({
        error: 'job_description is too short. Please paste the full job description.',
      });
    }

    // Run the AI evaluation
    const evaluation = await evaluateJob(job_description, cv_content);

    // Generate full report markdown
    const reportMd = await generateReportMarkdown(evaluation, job_url);

    // Auto-save to applications table scoped to user
    const globalScore = evaluation.score?.global;
    const keywords = evaluation.keywords || [];

    const appResult = await pool.query(
      `INSERT INTO applications
         (user_id, company, role, score, status, url, report_md,
          archetype, tldr, remote, comp_score, keywords)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, company, role, score, status, created_at`,
      [
        userId,
        evaluation.company || 'Unknown',
        evaluation.role || 'Unknown',
        globalScore !== undefined ? parseFloat(globalScore) : null,
        'Evaluated',
        job_url || null,
        reportMd,
        evaluation.archetype || null,
        evaluation.block_a?.tldr || null,
        evaluation.block_a?.remote || null,
        evaluation.score?.comp !== undefined ? parseFloat(evaluation.score.comp) : null,
        keywords.length > 0 ? keywords : null,
      ]
    );

    const savedApp = appResult.rows[0];

    res.json({
      application_id: savedApp.id,
      evaluation,
      report_md: reportMd,
      summary: {
        company: evaluation.company,
        role: evaluation.role,
        archetype: evaluation.archetype,
        score: globalScore,
        recommendation: evaluation.recommendation,
        recommendation_reason: evaluation.recommendation_reason,
        tldr: evaluation.block_a?.tldr,
      },
    });
  } catch (err) {
    console.error('POST /api/evaluate error:', err);

    if (err.message?.includes('Failed to parse')) {
      return res.status(500).json({
        error: 'The AI returned an unexpected response format. Please try again.',
        details: err.message,
      });
    }

    res.status(500).json({
      error: 'Evaluation failed. Please try again.',
      details: err.message,
    });
  }
});

export default router;
