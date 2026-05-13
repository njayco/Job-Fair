import { Router } from 'express';
import { anthropicClient, MODEL } from '../lib/evaluation.js';
import pool from '../db.js';

const router = Router();

const SYSTEM_PROMPT = `You are an expert AI career strategist, recruiter, and personal branding consultant.
You analyze a candidate's full background — work history, skills, education, projects, accomplishments — and return a structured JSON career analysis.
Be specific, evidence-based, and honest. Never fabricate experience the candidate does not have.
Respond ONLY with valid JSON matching the exact schema requested. No markdown, no explanation.`;

function buildCareerMatchPrompt(cvContent) {
  return `Analyze this candidate's CV and return a career match analysis.

## Candidate CV:
${cvContent}

Return this exact JSON structure:
{
  "career_matches": [
    {
      "role": "Job title",
      "match_pct": 88,
      "salary_range": "$85K–$140K",
      "growth_outlook": "Strong / Moderate / Declining",
      "transition_difficulty": "Easy / Moderate / Challenging",
      "why_you_match": "2-3 sentence explanation grounded in the candidate's actual experience"
    }
  ],
  "career_identity": {
    "current": "Current career identity label (e.g. Operations & Support Professional)",
    "emerging": "Emerging identity based on trajectory (e.g. AI-Native Product Strategist)",
    "long_term": "Long-term potential (e.g. Founder / Product Executive)"
  },
  "linkedin": {
    "headline": "Optimized LinkedIn headline (under 220 chars)",
    "about": "Rewritten About section (3-4 sentences, professional storytelling, first person)"
  },
  "strengths_gaps": {
    "strongest": ["Top 3-5 strongest experiences or accomplishments from the CV"],
    "underutilized": ["2-3 accomplishments or skills that are underrepresented in the CV"],
    "missing_keywords": ["5-8 high-value keywords missing from the CV that would strengthen their positioning"]
  }
}

Rules:
- Return exactly 5 career_matches ordered by match_pct descending
- All analysis must be grounded in the actual CV content provided
- Do not fabricate roles, metrics, or experience not present in the CV
- match_pct must be a number between 50 and 99`;
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, result_json->>'created_label' AS label,
              (result_json->'career_matches'->0->>'role') AS top_role,
              (result_json->'career_matches'->0->>'match_pct')::int AS top_pct,
              created_at
       FROM career_matches
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error('GET /api/career-match error:', err);
    res.status(500).json({ error: 'Failed to fetch career match history.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM career_matches WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Career match not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/career-match/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch career match.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const cvResult = await pool.query(
      'SELECT content_md FROM cvs WHERE user_id = $1',
      [req.user.id]
    );
    const cvContent = cvResult.rows[0]?.content_md || '';

    if (!cvContent || cvContent.trim().length < 50) {
      return res.status(400).json({
        error: 'No CV found. Please save your CV on the Evaluate page first.',
        code: 'NO_CV',
      });
    }

    const message = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildCareerMatchPrompt(cvContent) }],
    });

    const responseText = message.content[0]?.text || '';
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
      responseText.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText;

    let analysis;
    try {
      analysis = JSON.parse(jsonStr.trim());
    } catch (e) {
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }

    const insertResult = await pool.query(
      'INSERT INTO career_matches (user_id, result_json) VALUES ($1, $2) RETURNING id, created_at',
      [req.user.id, JSON.stringify(analysis)]
    );

    res.json({
      id: insertResult.rows[0].id,
      created_at: insertResult.rows[0].created_at,
      ...analysis,
    });
  } catch (err) {
    console.error('POST /api/career-match error:', err);
    res.status(500).json({
      error: 'Failed to run career analysis. Please try again.',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
});

export default router;
