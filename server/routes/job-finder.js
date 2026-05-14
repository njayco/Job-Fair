import { Router } from 'express';
import { anthropicClient, MODEL } from '../lib/evaluation.js';
import pool from '../db.js';

const router = Router();

const EXA_BASE = 'https://api.exa.ai';
const JOB_DOMAINS = [
  'greenhouse.io',
  'lever.co',
  'wellfound.com',
  'jobs.ashbyhq.com',
  'workable.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
  'boards.greenhouse.io',
  'jobs.lever.co',
];

async function exaSearch(query) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error('EXA_API_KEY is not configured.');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(`${EXA_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      numResults: 5,
      includeDomains: JOB_DOMAINS,
      startPublishedDate: thirtyDaysAgo,
      type: 'neural',
      contents: {
        text: { maxCharacters: 2500 },
      },
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    console.error(`Exa search failed (${res.status}):`, err);
    return { results: [] };
  }

  return res.json();
}

function buildSearchQueries(topRoles, preferences) {
  const location = preferences.location?.trim();
  const workStyle = preferences.work_style;
  const focusArea = preferences.focus_area?.trim();
  const styleTag = workStyle === 'remote' ? 'remote' : workStyle === 'hybrid' ? 'hybrid' : '';

  return topRoles.slice(0, 3).map(role => {
    let q = `${role} job opening hiring 2024 2025`;
    if (styleTag) q += ` ${styleTag}`;
    if (location && workStyle !== 'remote') q += ` ${location}`;
    if (focusArea) q += ` ${focusArea}`;
    return q;
  });
}

function buildScoringPrompt(cvContent, jobs, preferences) {
  const prefs = [
    preferences.location ? `Location preference: ${preferences.location}` : '',
    preferences.work_style ? `Work style: ${preferences.work_style}` : '',
    (preferences.salary_min || preferences.salary_max)
      ? `Target salary: $${preferences.salary_min || 0}K–$${preferences.salary_max || '?'}K/year`
      : '',
    preferences.focus_area ? `Focus area: ${preferences.focus_area}` : '',
  ].filter(Boolean).join('\n');

  const jobList = jobs.map((j, i) => `
--- JOB ${i + 1} ---
URL: ${j.url}
Published: ${j.publishedDate || 'Unknown'}
Text:
${(j.text || '').slice(0, 2200)}
`).join('\n');

  return `You are an expert career strategist. Score each job posting against the candidate's CV.

## Candidate Preferences
${prefs || 'No specific preferences.'}

## Candidate CV
${cvContent.slice(0, 3500)}

## Job Postings (${jobs.length} total)
${jobList}

Return a JSON array of exactly ${jobs.length} objects in the same order as the job postings above:
[
  {
    "index": 1,
    "role": "exact job title from posting",
    "company": "company name from posting text or URL domain",
    "url": "exact URL",
    "location": "city/country or Remote or Hybrid",
    "remote_ok": true or false,
    "match_pct": integer between 40 and 97,
    "why_match": ["3 specific bullets grounded in the CV"],
    "skill_gaps": ["1-2 honest gaps"],
    "comp_low": annual USD integer or null,
    "comp_high": annual USD integer or null,
    "description": "2-3 sentence summary of the role and why it suits this candidate"
  }
]

Rules:
- Spread match_pct realistically across the 40–97 range — do not cluster around one number
- Extract company name from posting content or from the URL (e.g. lever.co/acme → Acme)
- Use salary from posting if stated; otherwise estimate from market data for the role/location
- Base all bullets on specific evidence from the candidate's CV
- Return ONLY the JSON array — no markdown fences, no explanation`;
}

router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,
              results->0->>'role' AS top_role,
              (results->0->>'match_pct')::int AS top_pct,
              jsonb_array_length(results) AS result_count,
              preferences,
              created_at
       FROM job_finder_runs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error('GET /api/job-finder/history error:', err);
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM job_finder_runs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Run not found.' });
    const row = result.rows[0];
    res.json({ id: row.id, preferences: row.preferences, results: row.results, created_at: row.created_at });
  } catch (err) {
    console.error('GET /api/job-finder/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch run.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { cv_content: cvFromBody, preferences = {} } = req.body;

    let cvContent = '';
    if (cvFromBody && typeof cvFromBody === 'string' && cvFromBody.trim().length >= 50) {
      cvContent = cvFromBody.trim();
      pool.query(
        `INSERT INTO cvs (user_id, content_md) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET content_md = EXCLUDED.content_md, updated_at = NOW()`,
        [req.user.id, cvContent]
      ).catch(e => console.error('CV upsert warning:', e.message));
    } else {
      const r = await pool.query('SELECT content_md FROM cvs WHERE user_id = $1', [req.user.id]);
      cvContent = r.rows[0]?.content_md || '';
    }

    if (!cvContent || cvContent.trim().length < 50) {
      return res.status(400).json({ error: 'No CV found. Please paste your resume.', code: 'NO_CV' });
    }

    const matchResult = await pool.query(
      `SELECT result_json->'career_matches' AS matches
       FROM career_matches WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    const careerMatches = matchResult.rows[0]?.matches || [];
    const topRoles = careerMatches.slice(0, 3).map(m => m.role).filter(Boolean);

    if (!topRoles.length) {
      if (preferences.focus_area?.trim()) topRoles.push(preferences.focus_area.trim());
      else topRoles.push('senior professional');
    }

    const queries = buildSearchQueries(topRoles, preferences);
    console.log('Job Finder: Exa queries:', queries);

    const searchResults = await Promise.allSettled(queries.map(q => exaSearch(q)));

    const seen = new Set();
    const allJobs = [];
    for (const r of searchResults) {
      if (r.status === 'fulfilled' && Array.isArray(r.value?.results)) {
        for (const job of r.value.results) {
          if (job.url && !seen.has(job.url) && job.text?.length > 100) {
            seen.add(job.url);
            allJobs.push(job);
          }
        }
      }
    }

    console.log(`Job Finder: ${allJobs.length} unique postings from Exa`);

    if (!allJobs.length) {
      return res.status(400).json({
        error: 'No job postings found. Try adjusting your preferences or running Career Matching first.',
        code: 'NO_RESULTS',
      });
    }

    const scoringPrompt = buildScoringPrompt(cvContent, allJobs, preferences);
    const message = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: 'You are an expert career strategist. Respond ONLY with a valid JSON array. No markdown, no explanation.',
      messages: [{ role: 'user', content: scoringPrompt }],
    });

    const responseText = message.content[0]?.text || '';
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
      responseText.match(/(\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText.trim();

    let scored;
    try {
      scored = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`Failed to parse AI scoring response: ${e.message}`);
    }

    if (!Array.isArray(scored)) throw new Error('AI returned invalid scoring format.');

    const normalized = scored
      .filter(j => j && typeof j.match_pct === 'number')
      .map(j => ({
        index: Number(j.index),
        role: String(j.role || 'Unknown Role'),
        company: String(j.company || 'Unknown Company'),
        url: String(j.url || ''),
        location: String(j.location || 'Unknown'),
        remote_ok: Boolean(j.remote_ok),
        match_pct: Math.min(99, Math.max(0, Math.round(Number(j.match_pct)))),
        why_match: Array.isArray(j.why_match) ? j.why_match.map(String) : [],
        skill_gaps: Array.isArray(j.skill_gaps) ? j.skill_gaps.map(String) : [],
        comp_low: j.comp_low ? Number(j.comp_low) : null,
        comp_high: j.comp_high ? Number(j.comp_high) : null,
        description: String(j.description || ''),
      }))
      .sort((a, b) => b.match_pct - a.match_pct);

    const insertResult = await pool.query(
      `INSERT INTO job_finder_runs (user_id, preferences, results)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [req.user.id, JSON.stringify(preferences), JSON.stringify(normalized)]
    );

    res.json({
      id: insertResult.rows[0].id,
      created_at: insertResult.rows[0].created_at,
      preferences,
      results: normalized,
    });

  } catch (err) {
    console.error('POST /api/job-finder error:', err);
    res.status(500).json({
      error: err.message || 'Job search failed. Please try again.',
    });
  }
});

export default router;
