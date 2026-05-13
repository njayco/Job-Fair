import { Router } from 'express';
import { evaluateJob, generateReportMarkdown } from '../lib/evaluation.js';
import pool from '../db.js';

const router = Router();

// POST /api/evaluate
// Body: { job_description, cv_content }
// cv_content is always required.
router.post('/', async (req, res) => {
  try {
    const { job_description, cv_content } = req.body;
    const userId = req.user.id;

    if (!cv_content) {
      return res.status(400).json({
        error: 'cv_content is required. Paste your CV in markdown format.',
      });
    }

    if (!job_description) {
      return res.status(400).json({
        error: 'job_description is required. Paste the full job description text.',
      });
    }

    if (job_description.trim().length < 50) {
      return res.status(400).json({
        error: 'job_description is too short. Please paste the full job description.',
      });
    }

    const evaluation = await evaluateJob(job_description, cv_content);
    const reportMd = await generateReportMarkdown(evaluation);

    const globalScore = evaluation.score?.global;
    const keywords = evaluation.keywords || [];

    const appResult = await pool.query(
      `INSERT INTO applications
         (user_id, company, role, score, status, url, report_md,
          archetype, tldr, remote, comp_score, keywords, evaluation_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, company, role, score, status, created_at`,
      [
        userId,
        evaluation.company || 'Unknown',
        evaluation.role || 'Unknown',
        globalScore !== undefined ? parseFloat(globalScore) : null,
        'Evaluated',
        null,
        reportMd,
        evaluation.archetype || null,
        evaluation.block_a?.tldr || null,
        evaluation.block_a?.remote || null,
        evaluation.score?.comp !== undefined ? parseFloat(evaluation.score.comp) : null,
        keywords.length > 0 ? keywords : null,
        JSON.stringify(evaluation),
      ]
    );

    const savedApp = appResult.rows[0];

    // Silently upsert CV into cvs table so Career Matching + Revise My Resume work on any device
    pool.query(
      `INSERT INTO cvs (user_id, content_md) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET content_md = EXCLUDED.content_md, updated_at = NOW()`,
      [userId, cv_content]
    ).catch(e => console.error('CV upsert warning:', e.message));

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
