import { Router } from 'express';
import pool from '../db.js';
import { evaluateJob, generateReportMarkdown, anthropicClient, MODEL } from '../lib/evaluation.js';
import { DEFAULT_COMPANIES } from '../data/companies.js';
import { VALID_INDUSTRIES } from '../lib/industries.js';

const router = Router();

const MAX_AUTO_EVALS = 20;

const DEFAULT_KEYWORDS_POSITIVE = [
  'AI', 'ML', 'LLM', 'Agent', 'Agentic', 'GenAI', 'NLP', 'MLOps', 'LLMOps',
  'Voice AI', 'Conversational AI', 'Speech',
  'Platform Engineer', 'Solutions Architect', 'Solutions Engineer',
  'Forward Deployed', 'Customer Engineer', 'Integration Engineer',
  'Product Manager', 'Technical PM',
  'Automation', 'Low-Code', 'No-Code', 'GTM Engineer', 'RevOps',
  'Business Systems', 'Internal Tools',
];

const DEFAULT_KEYWORDS_NEGATIVE = [
  'Junior', 'Intern', 'iOS', 'Android', 'PHP', 'Ruby',
  'Embedded', 'Firmware', 'FPGA', 'Blockchain', 'Web3', 'Crypto',
];

// ── API URL builders ──────────────────────────────────────────────────────────

function buildApiUrl(api_type, api_slug) {
  const slug = encodeURIComponent(api_slug);
  switch (api_type) {
    case 'greenhouse':
      return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
    case 'greenhouse_eu':
      return `https://boards-api.eu.greenhouse.io/v1/boards/${slug}/jobs`;
    case 'ashby':
      return `https://api.ashbyhq.com/posting-api/job-board/${slug}/jobPostings`;
    case 'lever':
      return `https://api.lever.co/v0/postings/${slug}?mode=json`;
    default:
      return null;
  }
}

// ── Fetch jobs from a single company ─────────────────────────────────────────

async function fetchCompanyJobs(company) {
  const url = buildApiUrl(company.api_type, company.api_slug);
  if (!url) return [];

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'CareerOps/1.0' },
    });
    if (!res.ok) {
      console.warn(`[scanner] ${company.api_type}/${company.api_slug} → HTTP ${res.status} — skipping`);
      return [];
    }
    const data = await res.json();

    if (company.api_type === 'greenhouse' || company.api_type === 'greenhouse_eu') {
      return (data.jobs || []).map(j => ({
        title: j.title || '',
        url: j.absolute_url || '',
        location: j.location?.name || '',
        company: company.name,
        api_type: company.api_type,
      }));
    }

    if (company.api_type === 'ashby') {
      return (data.jobPostings || []).map(j => ({
        title: j.title || '',
        url: j.jobUrl || '',
        location: j.isRemote ? 'Remote' : (j.locationName || ''),
        company: company.name,
        api_type: company.api_type,
      }));
    }

    if (company.api_type === 'lever') {
      const jobs = Array.isArray(data) ? data : [];
      return jobs.map(j => ({
        title: j.text || '',
        url: j.hostedUrl || '',
        location: j.categories?.location || (j.workplaceType === 'remote' ? 'Remote' : ''),
        company: company.name,
        api_type: company.api_type,
      }));
    }

    return [];
  } catch (err) {
    console.warn(`[scanner] ${company.api_type}/${company.api_slug} → ${err.message ?? 'fetch error'} — skipping`);
    return [];
  }
}

// ── Keyword filtering ─────────────────────────────────────────────────────────

function matchesKeywords(title, positiveKws, negativeKws) {
  const t = title.toLowerCase();
  const hasNegative = negativeKws.some(kw => t.includes(kw.toLowerCase()));
  if (hasNegative) return false;
  if (positiveKws.length === 0) return true;
  return positiveKws.some(kw => t.includes(kw.toLowerCase()));
}

// ── Build a minimal job description for evaluation ────────────────────────────

function buildJobDescription(job) {
  const lines = [
    `${job.title} at ${job.company}`,
    job.location ? `Location: ${job.location}` : '',
    '',
    `This is a ${job.title} role at ${job.company}.`,
    `Full job posting: ${job.url}`,
    '',
    'Note: This listing was discovered via automated portal scanning.',
    'The AI evaluation below is based on the role title and company context.',
    'Review the full posting for complete requirements before applying.',
  ].filter(l => l !== undefined);
  return lines.join('\n');
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function ensureCompaniesSeeded(userId) {
  // Only seed once per user — check the flag in scanner_config.
  // If the user later deletes all companies, we respect that choice and don't re-seed.
  const { rows: cfg } = await pool.query(
    'SELECT companies_seeded FROM scanner_config WHERE user_id = $1',
    [userId]
  );
  if (cfg.length > 0 && cfg[0].companies_seeded) return;

  const { rows } = await pool.query(
    'SELECT COUNT(*) AS cnt FROM scanner_companies WHERE user_id = $1',
    [userId]
  );
  if (parseInt(rows[0].cnt, 10) === 0) {
    for (const c of DEFAULT_COMPANIES) {
      await pool.query(
        `INSERT INTO scanner_companies (user_id, name, api_type, api_slug, industry, enabled)
         VALUES ($1,$2,$3,$4,$5,TRUE)
         ON CONFLICT ON CONSTRAINT scanner_companies_user_ats_slug_unique DO NOTHING`,
        [userId, c.name, c.api_type, c.api_slug.toLowerCase(), c.industry ?? 'Technology']
      );
    }
    // Mark as seeded so future company deletions don't trigger re-seeding
    await pool.query(
      'UPDATE scanner_config SET companies_seeded = TRUE WHERE user_id = $1',
      [userId]
    );
  }
}

async function ensureConfigSeeded(userId) {
  const { rows } = await pool.query(
    'SELECT id FROM scanner_config WHERE user_id = $1',
    [userId]
  );
  if (rows.length === 0) {
    await pool.query(
      `INSERT INTO scanner_config (user_id, keywords_positive, keywords_negative)
       VALUES ($1, $2, $3)`,
      [userId, DEFAULT_KEYWORDS_POSITIVE, DEFAULT_KEYWORDS_NEGATIVE]
    );
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/scanner/companies
router.get('/companies', async (req, res) => {
  try {
    await ensureCompaniesSeeded(req.user.id);
    const { rows } = await pool.query(
      'SELECT * FROM scanner_companies WHERE user_id = $1 ORDER BY name ASC',
      [req.user.id]
    );
    res.json({ companies: rows });
  } catch (err) {
    console.error('scanner/companies GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scanner/companies
router.post('/companies', async (req, res) => {
  const { name, api_type, api_slug, industry } = req.body;
  if (!name || !api_type || !api_slug) {
    return res.status(400).json({ error: 'name, api_type, api_slug required' });
  }
  const validTypes = ['greenhouse', 'greenhouse_eu', 'ashby', 'lever'];
  if (!validTypes.includes(api_type)) {
    return res.status(400).json({ error: `api_type must be one of: ${validTypes.join(', ')}` });
  }
  const industryValue = industry?.trim() || 'Technology';
  if (!VALID_INDUSTRIES.includes(industryValue)) {
    return res.status(400).json({ error: `industry must be one of: ${VALID_INDUSTRIES.join(', ')}` });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO scanner_companies (user_id, name, api_type, api_slug, industry, enabled)
       VALUES ($1,$2,$3,$4,$5,TRUE)
       ON CONFLICT ON CONSTRAINT scanner_companies_user_ats_slug_unique DO NOTHING
       RETURNING *`,
      [req.user.id, name.trim(), api_type, api_slug.trim().toLowerCase(), industryValue]
    );
    if (rows.length === 0) {
      return res.status(409).json({ error: 'A company with this slug already exists in your list.' });
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/scanner/companies/:id
router.patch('/companies/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, api_type, api_slug, enabled, industry } = req.body;
  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM scanner_companies WHERE id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Company not found' });

    const fields = [];
    const vals = [];
    let idx = 1;
    if (name !== undefined)      { fields.push(`name=$${idx++}`);      vals.push(name); }
    if (api_type !== undefined) {
      const validTypes = ['greenhouse', 'greenhouse_eu', 'ashby', 'lever'];
      if (!validTypes.includes(api_type)) {
        return res.status(400).json({ error: `api_type must be one of: ${validTypes.join(', ')}` });
      }
      fields.push(`api_type=$${idx++}`);
      vals.push(api_type);
    }
    if (api_slug !== undefined)  { fields.push(`api_slug=$${idx++}`);  vals.push(api_slug.toLowerCase()); }
    if (enabled !== undefined)   { fields.push(`enabled=$${idx++}`);   vals.push(enabled); }
    if (industry !== undefined) {
      if (!VALID_INDUSTRIES.includes(industry)) {
        return res.status(400).json({ error: `industry must be one of: ${VALID_INDUSTRIES.join(', ')}` });
      }
      fields.push(`industry=$${idx++}`);
      vals.push(industry);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE scanner_companies SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,
      vals
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/scanner/companies/:id
router.delete('/companies/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM scanner_companies WHERE id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Company not found' });
    res.json({ deleted: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scanner/config
router.get('/config', async (req, res) => {
  try {
    await ensureConfigSeeded(req.user.id);
    const { rows } = await pool.query(
      'SELECT * FROM scanner_config WHERE user_id=$1',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/scanner/config
router.put('/config', async (req, res) => {
  const { keywords_positive, keywords_negative } = req.body;
  if (!Array.isArray(keywords_positive) || !Array.isArray(keywords_negative)) {
    return res.status(400).json({ error: 'keywords_positive and keywords_negative must be arrays' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO scanner_config (user_id, keywords_positive, keywords_negative)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE
         SET keywords_positive=$2, keywords_negative=$3, updated_at=NOW()
       RETURNING *`,
      [req.user.id, keywords_positive, keywords_negative]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scanner/runs
router.get('/runs', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, companies_scanned, total_fetched, new_found, matches_evaluated,
              status, started_at, finished_at, created_at
       FROM scanner_runs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`,
      [req.user.id]
    );
    res.json({ runs: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scanner/runs/:id
router.get('/runs/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM scanner_runs WHERE id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    const run = rows[0];
    res.json({
      ...run,
      results: run.results_json ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scanner/run  — fetch + filter + dedupe + auto-evaluate
// Body (optional): { cv_content: string }  — overrides the saved CV for this run
router.post('/run', async (req, res) => {
  const userId = req.user.id;
  const startedAt = new Date();

  try {
    await ensureCompaniesSeeded(userId);
    await ensureConfigSeeded(userId);

    // Load keyword config
    const { rows: configRows } = await pool.query(
      'SELECT keywords_positive, keywords_negative FROM scanner_config WHERE user_id=$1',
      [userId]
    );
    const config = configRows[0];
    const posKws = config?.keywords_positive ?? DEFAULT_KEYWORDS_POSITIVE;
    const negKws = config?.keywords_negative ?? DEFAULT_KEYWORDS_NEGATIVE;

    // Use pasted CV from request body if provided, otherwise fall back to saved CV
    let cvContent = null;
    if (req.body?.cv_content && req.body.cv_content.trim().length >= 50) {
      cvContent = req.body.cv_content.trim();
    } else {
      const { rows: cvRows } = await pool.query(
        'SELECT content_md FROM cvs WHERE user_id=$1',
        [userId]
      );
      cvContent = cvRows[0]?.content_md ?? null;
    }
    const canEvaluate = cvContent && cvContent.trim().length >= 50;

    // Load enabled companies
    const { rows: companies } = await pool.query(
      'SELECT * FROM scanner_companies WHERE user_id=$1 AND enabled=TRUE ORDER BY name ASC',
      [userId]
    );
    if (companies.length === 0) {
      return res.status(400).json({ error: 'No companies enabled. Enable at least one company in the Companies tab.' });
    }

    // Load already-seen URLs for this user
    const { rows: seenRows } = await pool.query(
      'SELECT job_url FROM scanner_seen_urls WHERE user_id=$1',
      [userId]
    );
    const seenUrls = new Set(seenRows.map(r => r.job_url));

    // Fetch from all companies concurrently in batches of 6
    const BATCH_SIZE = 6;
    const allJobs = [];
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(c => fetchCompanyJobs(c)));
      results.forEach(jobs => allJobs.push(...jobs));
    }

    // Filter by keywords
    const relevant = allJobs.filter(j => j.url && matchesKeywords(j.title, posKws, negKws));

    // Separate new vs already-seen
    const newJobs = relevant.filter(j => !seenUrls.has(j.url));

    // Mark new URLs as seen immediately (before evaluation, so parallel tabs don't duplicate)
    for (const job of newJobs) {
      try {
        await pool.query(
          `INSERT INTO scanner_seen_urls (user_id, job_url, job_title, company)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [userId, job.url, job.title.slice(0, 499), job.company]
        );
      } catch { /* ignore duplicates */ }
    }

    // ── Auto-evaluate up to MAX_AUTO_EVALS new jobs ──────────────────────────
    const toEvaluate = canEvaluate ? newJobs.slice(0, MAX_AUTO_EVALS) : [];
    const results = newJobs.map(job => ({ ...job, application_id: null, score: null, recommendation: null }));

    let evaluated = 0;
    for (const job of toEvaluate) {
      try {
        const jobDescription = buildJobDescription(job);
        const evaluation = await evaluateJob(jobDescription, cvContent);
        const reportMd = await generateReportMarkdown(evaluation);

        const globalScore = evaluation.score?.global;
        const keywords = evaluation.keywords || [];

        const safeKeywords = Array.isArray(keywords)
          ? keywords.map(String)
          : (typeof keywords === 'string' ? keywords.split(',').map(s => s.trim()).filter(Boolean) : []);

        const { rows: appRows } = await pool.query(
          `INSERT INTO applications
             (user_id, company, role, score, status, url, report_md,
              archetype, tldr, remote, comp_score, keywords, evaluation_json)
           VALUES ($1,$2,$3,$4,'Evaluated',$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING id`,
          [
            userId,
            evaluation.company || job.company,
            evaluation.role || job.title,
            globalScore !== undefined ? parseFloat(globalScore) : null,
            job.url,
            reportMd,
            evaluation.archetype || null,
            evaluation.block_a?.tldr || null,
            evaluation.block_a?.remote || null,
            evaluation.score?.comp !== undefined ? parseFloat(evaluation.score.comp) : null,
            safeKeywords.length > 0 ? safeKeywords : null,
            JSON.stringify(evaluation),
          ]
        );

        const applicationId = appRows[0].id;
        evaluated++;

        // Update result entry with evaluation data
        const resultIdx = results.findIndex(r => r.url === job.url);
        if (resultIdx >= 0) {
          results[resultIdx] = {
            ...results[resultIdx],
            application_id: applicationId,
            score: globalScore ?? null,
            recommendation: evaluation.recommendation ?? null,
          };
        }
      } catch (evalErr) {
        console.error(`Scanner eval error for ${job.title} @ ${job.company}:`, evalErr.stack || evalErr.message);
        // Non-fatal — continue with remaining jobs
      }
    }

    // Save run record
    const finishedAt = new Date();
    const { rows: runRows } = await pool.query(
      `INSERT INTO scanner_runs
         (user_id, companies_scanned, total_fetched, new_found, matches_evaluated,
          status, started_at, finished_at, results_json)
       VALUES ($1,$2,$3,$4,$5,'completed',$6,$7,$8)
       RETURNING *`,
      [
        userId,
        companies.length,
        allJobs.length,
        newJobs.length,
        evaluated,
        startedAt,
        finishedAt,
        JSON.stringify(results),
      ]
    );
    const run = runRows[0];

    res.json({
      run_id: run.id,
      companies_scanned: run.companies_scanned,
      total_fetched: run.total_fetched,
      new_found: run.new_found,
      matches_evaluated: run.matches_evaluated,
      status: run.status,
      started_at: run.started_at,
      finished_at: run.finished_at,
      results,
      created_at: run.created_at,
      cv_missing: !canEvaluate,
    });
  } catch (err) {
    console.error('scanner/run error:', err.stack || err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/scanner/history  — reset seen URLs and runs
router.delete('/history', async (req, res) => {
  try {
    await pool.query('DELETE FROM scanner_seen_urls WHERE user_id=$1', [req.user.id]);
    await pool.query('DELETE FROM scanner_runs WHERE user_id=$1', [req.user.id]);
    res.json({ reset: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI Company Discovery ───────────────────────────────────────────────────────

// Exa helpers (scoped to scanner — discovers companies rather than specific jobs)
const EXA_BASE_URL = 'https://api.exa.ai';

function exaDiscoverHeaders() {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error('EXA_API_KEY is not configured.');
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
}

async function exaDiscoverSearch(query, domains) {
  try {
    const res = await fetch(`${EXA_BASE_URL}/search`, {
      method: 'POST',
      headers: exaDiscoverHeaders(),
      body: JSON.stringify({
        query,
        numResults: 10,
        includeDomains: domains,
        type: 'neural',
        category: 'job posting',
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { results: [] };
    return res.json();
  } catch {
    return { results: [] };
  }
}

// Parse ATS type + slug from a job board URL
function parseAtsFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    const slug = parts[0];
    if (slug.length < 2 || slug.length > 80) return null;

    if (host === 'boards.greenhouse.io') return { api_type: 'greenhouse', api_slug: slug.toLowerCase() };
    if (host === 'boards.eu.greenhouse.io') return { api_type: 'greenhouse_eu', api_slug: slug.toLowerCase() };
    if (host === 'jobs.lever.co') return { api_type: 'lever', api_slug: slug.toLowerCase() };
    if (host === 'jobs.ashbyhq.com') return { api_type: 'ashby', api_slug: slug.toLowerCase() };
  } catch {}
  return null;
}

// POST /api/scanner/discover  — AI-powered company discovery via Claude + Exa
// Body (optional): { cv_content: string }
router.post('/discover', async (req, res) => {
  const userId = req.user.id;

  try {
    // Resolve CV
    let cvContent = '';
    const bodyCV = req.body?.cv_content;
    if (bodyCV && typeof bodyCV === 'string' && bodyCV.trim().length >= 50) {
      cvContent = bodyCV.trim();
    } else {
      const { rows } = await pool.query('SELECT content_md FROM cvs WHERE user_id=$1', [userId]);
      cvContent = rows[0]?.content_md?.trim() ?? '';
    }
    if (cvContent.length < 50) {
      return res.status(400).json({ error: 'No CV found. Please paste your resume before running discovery.', code: 'NO_CV' });
    }

    // Get existing company (api_type, api_slug) pairs so we can exclude them
    const { rows: existing } = await pool.query(
      'SELECT api_type, api_slug FROM scanner_companies WHERE user_id=$1',
      [userId]
    );
    const existingSlugs = new Set(existing.map(r => `${r.api_type}:${r.api_slug.toLowerCase()}`));

    // Step 1: Ask Claude to generate Exa search queries based on the CV
    const queryGenPrompt = `You are a career assistant. Based on the candidate CV below, generate 9 diverse Exa neural search queries to discover relevant tech companies that have open job postings on Greenhouse, Lever, or Ashby job boards.

Focus on different angles:
- 3 queries for roles the candidate is strongest for (be specific about role + tech stack)
- 3 queries for company types/sectors that would be a great match
- 3 queries targeting growth-stage or public tech companies that would value this background

CV (first 2000 chars):
${cvContent.slice(0, 2000)}

Return ONLY a JSON array of 9 search query strings. No markdown, no explanation.
Example: ["senior ML engineer AI startup 2025 greenhouse jobs", "platform engineer fintech scale-up hiring lever", ...]`;

    const queryMsg = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: 'You are a career assistant. Respond ONLY with a valid JSON array of strings.',
      messages: [{ role: 'user', content: queryGenPrompt }],
    });

    let queries = [];
    try {
      const raw = queryMsg.content[0]?.text || '';
      const match = raw.match(/\[[\s\S]*\]/);
      queries = JSON.parse(match ? match[0] : raw);
      if (!Array.isArray(queries)) queries = [];
    } catch {
      queries = [];
    }
    if (queries.length === 0) {
      return res.status(500).json({ error: 'Failed to generate search queries.' });
    }

    // Step 2: Run Exa searches against ATS domains in parallel
    const ATS_DOMAINS = [
      'boards.greenhouse.io',
      'boards.eu.greenhouse.io',
      'jobs.lever.co',
      'jobs.ashbyhq.com',
    ];

    const searchResults = await Promise.allSettled(
      queries.map(q => exaDiscoverSearch(q, ATS_DOMAINS))
    );

    // Collect and deduplicate parsed ATS entries
    const seen = new Set();
    const candidates = [];
    for (const r of searchResults) {
      if (r.status !== 'fulfilled' || !Array.isArray(r.value?.results)) continue;
      for (const item of r.value.results) {
        const parsed = parseAtsFromUrl(item.url || '');
        if (!parsed) continue;
        const key = `${parsed.api_type}:${parsed.api_slug.toLowerCase()}`;
        if (seen.has(key)) continue;
        if (existingSlugs.has(key)) continue;
        seen.add(key);
        candidates.push(parsed);
      }
    }

    if (candidates.length === 0) {
      return res.json({ companies: [] });
    }

    // Cap to 40 candidates before sending to Claude for ranking
    const toRank = candidates.slice(0, 40);

    // Step 3: Ask Claude to identify company names and rank by CV fit
    const rankPrompt = `You are a career strategist. Given a candidate CV and a list of ATS job board slugs, identify the real company name for each slug and rank them by how good a fit they would be for the candidate.

CV (first 2500 chars):
${cvContent.slice(0, 2500)}

ATS slugs to evaluate (each is a unique company's job board):
${toRank.map((c, i) => `${i + 1}. slug="${c.api_slug}" ats="${c.api_type}"`).join('\n')}

Rules:
- Map each slug to its real company name (e.g. "datadoghq" → "Datadog", "mondaydotcom" → "monday.com")
- If you don't recognise a slug, make your best guess or use the slug as the name
- Rank ALL entries by fit score 1–100 (based on how well the company would suit this candidate's background)
- Write a concise 1-sentence fit reason grounded in the CV
- Return ONLY a JSON array sorted by fit_score descending

Schema:
[{"slug":"...", "api_type":"...", "name":"...", "fit_score":85, "fit_reason":"..."}]

Return ONLY the JSON array. No markdown, no explanation.`;

    const rankMsg = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: 'You are a career strategist. Respond ONLY with a valid JSON array.',
      messages: [{ role: 'user', content: rankPrompt }],
    });

    let ranked = [];
    try {
      const raw = rankMsg.content[0]?.text || '';
      const match = raw.match(/\[[\s\S]*\]/);
      ranked = JSON.parse(match ? match[0] : raw);
      if (!Array.isArray(ranked)) ranked = [];
    } catch {
      ranked = [];
    }

    // Build a lookup of the Exa-parsed candidates to constrain Claude's output
    // — this prevents hallucinated or invalid slugs from entering the watchlist
    const parsedLookup = new Map(
      toRank.map(c => [`${c.api_type}:${c.api_slug.toLowerCase()}`, c])
    );
    const ALLOWED_API_TYPES = new Set(['greenhouse', 'greenhouse_eu', 'ashby', 'lever']);

    const normalised = ranked
      .filter(c => c && c.slug && c.api_type && c.name)
      .filter(c => ALLOWED_API_TYPES.has(String(c.api_type)))
      .filter(c => parsedLookup.has(`${String(c.api_type)}:${String(c.slug).toLowerCase()}`))
      .filter(c => !existingSlugs.has(`${String(c.api_type)}:${String(c.slug).toLowerCase()}`))
      .map(c => ({
        name: String(c.name).slice(0, 100),
        api_type: String(c.api_type),
        api_slug: String(c.slug).slice(0, 80),
        fit_score: Math.min(100, Math.max(0, Number(c.fit_score) || 50)),
        fit_reason: String(c.fit_reason || '').slice(0, 300),
      }))
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 30);

    res.json({ companies: normalised });

  } catch (err) {
    console.error('scanner/discover error:', err);
    res.status(500).json({ error: err.message || 'Discovery failed. Please try again.' });
  }
});

// POST /api/scanner/discover-companies
// Body: { industry: string, count?: number }
// Queries Exa to find companies in the given industry that use Greenhouse/Lever/Ashby,
// validates discovered slugs, upserts valid ones into scanner_companies, returns summary.
router.post('/discover-companies', async (req, res) => {
  const userId = req.user.id;
  const { industry, count = 20 } = req.body ?? {};

  if (!industry || typeof industry !== 'string' || industry.trim().length === 0) {
    return res.status(400).json({ error: 'industry is required' });
  }
  if (!VALID_INDUSTRIES.includes(industry.trim())) {
    return res.status(400).json({ error: `industry must be one of: ${VALID_INDUSTRIES.join(', ')}` });
  }
  const industryLabel = industry.trim();
  const targetCount = Math.min(Math.max(1, parseInt(count, 10) || 20), 50);

  try {
    // Get existing company (api_type, api_slug) pairs to avoid duplicates
    const { rows: existing } = await pool.query(
      'SELECT api_type, api_slug FROM scanner_companies WHERE user_id=$1',
      [userId]
    );
    const existingSlugs = new Set(existing.map(r => `${r.api_type}:${r.api_slug.toLowerCase()}`));

    // Build Exa search queries for this industry
    const queries = [
      `${industryLabel} company jobs Greenhouse hiring 2025`,
      `${industryLabel} company careers Lever job board 2025`,
      `${industryLabel} company jobs Ashby hiring portal 2025`,
      `site:boards.greenhouse.io ${industryLabel} company`,
      `site:jobs.lever.co ${industryLabel} company`,
      `site:jobs.ashbyhq.com ${industryLabel} company`,
    ];

    const ATS_DOMAINS = [
      'boards.greenhouse.io',
      'boards.eu.greenhouse.io',
      'jobs.lever.co',
      'jobs.ashbyhq.com',
    ];

    // Run Exa searches in parallel
    const searchResults = await Promise.allSettled(
      queries.map(q => exaDiscoverSearch(q, ATS_DOMAINS))
    );

    // Collect and deduplicate parsed ATS entries
    const seen = new Set();
    const candidates = [];
    for (const r of searchResults) {
      if (r.status !== 'fulfilled' || !Array.isArray(r.value?.results)) continue;
      for (const item of r.value.results) {
        const parsed = parseAtsFromUrl(item.url || '');
        if (!parsed) continue;
        const key = `${parsed.api_type}:${parsed.api_slug.toLowerCase()}`;
        if (seen.has(key)) continue;
        if (existingSlugs.has(key)) continue;
        seen.add(key);
        candidates.push({ ...parsed, source_url: item.url });
      }
    }

    if (candidates.length === 0) {
      return res.json({ found: 0, added: 0, companies: [], industry: industryLabel });
    }

    const toProcess = candidates.slice(0, targetCount * 2);

    // Ask Claude to identify company names from the slugs
    const namePrompt = `You are a company research assistant. Given ATS job board slugs from the ${industryLabel} industry, identify the real company name for each slug.

ATS slugs to identify:
${toProcess.map((c, i) => `${i + 1}. slug="${c.api_slug}" ats="${c.api_type}"`).join('\n')}

Rules:
- Map each slug to its real company name (e.g. "datadoghq" → "Datadog")
- Only include companies that plausibly belong to the "${industryLabel}" industry
- If a slug clearly belongs to a different industry, exclude it
- Return ONLY a JSON array

Schema: [{"slug":"...", "api_type":"...", "name":"...", "include":true}]
Return ONLY the JSON array. No markdown, no explanation.`;

    const nameMsg = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: 'You are a company research assistant. Respond ONLY with a valid JSON array.',
      messages: [{ role: 'user', content: namePrompt }],
    });

    let named = [];
    try {
      const raw = nameMsg.content[0]?.text || '';
      const match = raw.match(/\[[\s\S]*\]/);
      named = JSON.parse(match ? match[0] : raw);
      if (!Array.isArray(named)) named = [];
    } catch {
      named = [];
    }

    // Build lookup map from claude-identified names
    const nameLookup = new Map();
    for (const n of named) {
      if (n && n.slug && n.name && n.include !== false) {
        nameLookup.set(`${n.api_type}:${n.slug.toLowerCase()}`, n.name);
      }
    }

    const ALLOWED_API_TYPES = new Set(['greenhouse', 'greenhouse_eu', 'ashby', 'lever']);

    // Validate each candidate slug against the real ATS API endpoint before upserting.
    // Only slugs that return HTTP 200 with a parseable body are accepted.
    async function validateAtsSlug(api_type, api_slug) {
      const url = buildApiUrl(api_type, api_slug);
      if (!url) return false;
      try {
        const r = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'CareerOps/1.0' },
        });
        if (!r.ok) return false;
        // For Greenhouse: expect { jobs: [...] }
        // For Ashby: expect { results: [...] } or { jobPostings: [...] }
        // For Lever: expect an array
        const body = await r.json();
        if (api_type === 'greenhouse' || api_type === 'greenhouse_eu') {
          return Array.isArray(body?.jobs);
        }
        if (api_type === 'ashby') {
          return Array.isArray(body?.results) || Array.isArray(body?.jobPostings);
        }
        if (api_type === 'lever') {
          return Array.isArray(body);
        }
        return false;
      } catch {
        return false;
      }
    }

    // Build the validated set in parallel batches to stay within the timeout budget.
    // We process up to targetCount*2 candidates but stop once we have enough valid ones.
    const validCandidates = [];
    const BATCH_SIZE = 8;
    for (let i = 0; i < toProcess.length && validCandidates.length < targetCount; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE).filter(c => {
        if (!ALLOWED_API_TYPES.has(c.api_type)) return false;
        if (existingSlugs.has(`${c.api_type}:${c.api_slug.toLowerCase()}`)) return false;
        const key = `${c.api_type}:${c.api_slug.toLowerCase()}`;
        return nameLookup.has(key);
      });
      const results = await Promise.allSettled(
        batch.map(c => validateAtsSlug(c.api_type, c.api_slug).then(ok => ({ c, ok })))
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.ok) {
          validCandidates.push(r.value.c);
        }
      }
    }

    // Upsert validated companies into the database
    const added = [];
    for (const c of validCandidates) {
      if (added.length >= targetCount) break;
      const key = `${c.api_type}:${c.api_slug.toLowerCase()}`;
      const companyName = nameLookup.get(key);
      if (!companyName) continue;

      try {
        const { rows } = await pool.query(
          `INSERT INTO scanner_companies (user_id, name, api_type, api_slug, industry, enabled)
           VALUES ($1,$2,$3,$4,$5,TRUE)
           ON CONFLICT ON CONSTRAINT scanner_companies_user_ats_slug_unique DO NOTHING
           RETURNING *`,
          [userId, companyName.slice(0, 255), c.api_type, c.api_slug.slice(0, 255).toLowerCase(), industryLabel]
        );
        if (rows.length > 0) {
          added.push(rows[0]);
          existingSlugs.add(`${c.api_type}:${c.api_slug.toLowerCase()}`);
        }
      } catch {
        // skip on conflict/error
      }
    }

    res.json({
      found: candidates.length,
      added: added.length,
      companies: added,
      industry: industryLabel,
    });

  } catch (err) {
    console.error('scanner/discover-companies error:', err);
    res.status(500).json({ error: err.message || 'Discovery failed. Please try again.' });
  }
});

export default router;
