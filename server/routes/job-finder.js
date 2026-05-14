import { Router } from 'express';
import { anthropicClient, MODEL } from '../lib/evaluation.js';
import pool from '../db.js';

const router = Router();

const EXA_BASE = 'https://api.exa.ai';

// Broad domain list — LinkedIn and Indeed included per requirement,
// though ATS boards (Greenhouse/Lever/Wellfound) tend to yield richer content
const JOB_DOMAINS = [
  'linkedin.com',
  'indeed.com',
  'greenhouse.io',
  'boards.greenhouse.io',
  'lever.co',
  'jobs.lever.co',
  'wellfound.com',
  'jobs.ashbyhq.com',
  'workable.com',
  'smartrecruiters.com',
];

function exaHeaders() {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error('EXA_API_KEY is not configured.');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
}

// Step 1 — Search: returns up to numResults URLs + titles, no heavy content
async function exaSearch(query, numResults = 5) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(`${EXA_BASE}/search`, {
    method: 'POST',
    headers: exaHeaders(),
    body: JSON.stringify({
      query,
      numResults,
      includeDomains: JOB_DOMAINS,
      startPublishedDate: thirtyDaysAgo,
      type: 'neural',
      category: 'job posting',
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    console.error(`Exa search failed (${res.status}): ${err}`);
    return { results: [] };
  }
  return res.json();
}

// Broad fallback search — no domain filter, used when the domain-filtered search returns 0 results
async function exaSearchBroad(query, numResults = 5) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(`${EXA_BASE}/search`, {
    method: 'POST',
    headers: exaHeaders(),
    body: JSON.stringify({
      query,
      numResults,
      startPublishedDate: thirtyDaysAgo,
      type: 'neural',
      category: 'job posting',
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    console.error(`Exa broad search failed (${res.status}): ${err}`);
    return { results: [] };
  }
  return res.json();
}

// Step 2 — Contents: fetch full text for a list of URLs via POST /contents
async function exaContents(urls, maxCharacters = 4000) {
  if (!urls.length) return [];

  const res = await fetch(`${EXA_BASE}/contents`, {
    method: 'POST',
    headers: exaHeaders(),
    body: JSON.stringify({
      ids: urls,
      text: { maxCharacters },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    console.error(`Exa /contents failed (${res.status}): ${err}`);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

// Extract top N skills from CV text by matching against a curated keyword list.
// Short/ambiguous tokens (R, Go, C#, etc.) use word-boundary regex to avoid false positives.
function extractTopSkills(cvContent, topN = 3) {
  const skillKeywords = [
    'JavaScript', 'TypeScript', 'Python', 'Golang', 'Java', 'Rust', 'Ruby', 'PHP',
    'Swift', 'Kotlin', 'Scala', 'MATLAB',
    // Short tokens — must be matched as whole words
    { term: 'Go', pattern: /\bgo\b/ },
    { term: 'R', pattern: /\br\b/ },
    { term: 'C#', pattern: /\bc#/i },
    { term: 'C++', pattern: /\bc\+\+/i },
    { term: '.NET', pattern: /\.net\b/i },
    'React', 'Vue', 'Angular', 'Node.js', 'Next.js', 'Django', 'FastAPI', 'Spring', 'Rails',
    'Laravel', 'Flask', 'Svelte', 'Express',
    'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD', 'DevOps',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'Spark',
    'TensorFlow', 'PyTorch', 'machine learning', 'deep learning', 'LLM', 'NLP',
    'GraphQL', 'REST', 'microservices', 'SQL', 'data analysis', 'product management',
    'Agile', 'Scrum', 'Figma', 'iOS', 'Android',
  ];
  const cvLower = cvContent.toLowerCase();
  const matched = [];
  for (const entry of skillKeywords) {
    if (matched.length >= topN) break;
    if (typeof entry === 'string') {
      if (cvLower.includes(entry.toLowerCase())) matched.push(entry);
    } else {
      if (entry.pattern.test(cvLower)) matched.push(entry.term);
    }
  }
  return matched;
}

// Infer seniority level from CV text
function extractSeniority(cvContent) {
  const cvLower = cvContent.toLowerCase();
  if (/\b(vp|vice president|director|chief|cto|ceo|coo)\b/.test(cvLower)) return 'executive';
  if (/\b(principal|staff engineer|distinguished)\b/.test(cvLower)) return 'principal';
  if (/\b(senior|sr\.?\s|lead)\b/.test(cvLower)) return 'senior';
  if (/\b(junior|jr\.?\s|entry.?level|graduate)\b/.test(cvLower)) return 'junior';
  return '';
}

function buildSearchQueries(topRoles, preferences, cvContent = '') {
  const location = preferences.location?.trim();
  const workStyle = preferences.work_style;
  const focusArea = preferences.focus_area?.trim();
  const styleTag = workStyle === 'remote' ? 'remote' : workStyle === 'hybrid' ? 'hybrid' : '';

  const topSkills = extractTopSkills(cvContent);
  const seniority = extractSeniority(cvContent);

  return topRoles.slice(0, 3).map(role => {
    const roleLower = role.toLowerCase();
    const seniorityPrefix = seniority && !roleLower.includes(seniority) ? `${seniority} ` : '';
    const currentYear = new Date().getFullYear();
    let q = `${seniorityPrefix}${role} job opening hiring ${currentYear}`;
    if (topSkills.length) q += ` ${topSkills.join(' ')}`;
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
Title: ${j.title || 'Unknown'}
Published: ${j.publishedDate || 'Unknown'}
Full Text:
${(j.text || '').slice(0, 3500)}
`).join('\n');

  return `You are an expert career strategist. Score each job posting against the candidate's CV.

## Candidate Preferences
${prefs || 'No specific preferences.'}

## Candidate CV
${cvContent.slice(0, 3000)}

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

    // Resolve CV
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

    // Get top career match roles
    const matchResult = await pool.query(
      `SELECT result_json->'career_matches' AS matches
       FROM career_matches WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    const careerMatches = matchResult.rows[0]?.matches || [];
    const topRoles = careerMatches.slice(0, 3).map(m => m.role).filter(Boolean);
    if (!topRoles.length) {
      topRoles.push(preferences.focus_area?.trim() || 'senior professional');
    }

    // STEP 1 — Exa search: get URLs and titles (no heavy content yet)
    const queries = buildSearchQueries(topRoles, preferences, cvContent);
    console.log('Job Finder: Exa search queries:', queries);

    const searchResults = await Promise.allSettled(queries.map(q => exaSearch(q, 5)));

    const collectResults = (settled) => {
      const seen = new Set();
      const items = [];
      for (const r of settled) {
        if (r.status === 'fulfilled' && Array.isArray(r.value?.results)) {
          for (const item of r.value.results) {
            if (item.url && !seen.has(item.url)) {
              seen.add(item.url);
              items.push(item);
            }
          }
        }
      }
      return items;
    };

    let searchItems = collectResults(searchResults);
    console.log(`Job Finder: ${searchItems.length} unique URLs from domain-filtered Exa search`);

    // Fallback: if domain-filtered search returned nothing, retry without domain restrictions
    if (!searchItems.length) {
      console.log('Job Finder: 0 results with domain filter — retrying with broad search (no domain filter)');
      const broadResults = await Promise.allSettled(queries.map(q => exaSearchBroad(q, 5)));
      searchItems = collectResults(broadResults);
      console.log(`Job Finder: ${searchItems.length} unique URLs from broad Exa search`);
    }

    if (!searchItems.length) {
      return res.status(400).json({
        error: 'No job postings found. Try adjusting your preferences or running Career Matching first.',
        code: 'NO_RESULTS',
      });
    }

    // Cap at 15 for cost efficiency
    const urlsToFetch = searchItems.slice(0, 15).map(i => i.url);

    // STEP 2 — Exa /contents: retrieve full text for each job URL
    console.log(`Job Finder: fetching full content for ${urlsToFetch.length} URLs via Exa /contents`);
    const contentItems = await exaContents(urlsToFetch, 4000);

    // Merge content back with search metadata; fall back to search item if /contents missed it
    const contentMap = new Map(contentItems.map(c => [c.url, c]));
    const allJobs = searchItems.slice(0, 15).map(item => {
      const content = contentMap.get(item.url);
      return {
        url: item.url,
        title: content?.title || item.title || '',
        publishedDate: content?.publishedDate || item.publishedDate || '',
        text: content?.text || '',
      };
    }).filter(j => j.text && j.text.length > 100);

    console.log(`Job Finder: ${allJobs.length} jobs with full content for scoring`);

    if (!allJobs.length) {
      return res.status(400).json({
        error: 'Could not retrieve job posting content. Please try again.',
        code: 'NO_CONTENT',
      });
    }

    // STEP 3 — Claude scoring
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

    // Normalize, attach full_text for Evaluate handoff, sort by match_pct
    const normalized = scored
      .filter(j => j && typeof j.match_pct === 'number')
      .map((j, i) => {
        const sourceJob = allJobs[Number(j.index ?? i + 1) - 1] || allJobs[i] || {};
        return {
          index: Number(j.index ?? i + 1),
          role: String(j.role || 'Unknown Role'),
          company: String(j.company || 'Unknown Company'),
          url: String(j.url || sourceJob.url || ''),
          location: String(j.location || 'Unknown'),
          remote_ok: Boolean(j.remote_ok),
          match_pct: Math.min(99, Math.max(0, Math.round(Number(j.match_pct)))),
          why_match: Array.isArray(j.why_match) ? j.why_match.map(String) : [],
          skill_gaps: Array.isArray(j.skill_gaps) ? j.skill_gaps.map(String) : [],
          comp_low: j.comp_low ? Number(j.comp_low) : null,
          comp_high: j.comp_high ? Number(j.comp_high) : null,
          description: String(j.description || ''),
          // Full posting text for pre-populating Evaluate page
          full_text: String(sourceJob.text || '').slice(0, 6000),
        };
      })
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
    res.status(500).json({ error: err.message || 'Job search failed. Please try again.' });
  }
});

export default router;
