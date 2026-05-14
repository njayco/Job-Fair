import { Router } from 'express';
import pool from '../db.js';
import { evaluateJob, generateReportMarkdown } from '../lib/evaluation.js';

const router = Router();

const MAX_AUTO_EVALS = 20;

// ── Seed data ────────────────────────────────────────────────────────────────

const DEFAULT_COMPANIES = [
  // Greenhouse US
  { name: 'Anthropic',         api_type: 'greenhouse',    api_slug: 'anthropic' },
  { name: 'Intercom',          api_type: 'greenhouse',    api_slug: 'intercom' },
  { name: 'Hume AI',           api_type: 'greenhouse',    api_slug: 'humeai' },
  { name: 'Airtable',          api_type: 'greenhouse',    api_slug: 'airtable' },
  { name: 'Vercel',            api_type: 'greenhouse',    api_slug: 'vercel' },
  { name: 'Temporal',          api_type: 'greenhouse',    api_slug: 'temporal' },
  { name: 'Arize AI',          api_type: 'greenhouse',    api_slug: 'arizeai' },
  { name: 'RunPod',            api_type: 'greenhouse',    api_slug: 'runpod' },
  { name: 'Glean',             api_type: 'greenhouse',    api_slug: 'gleanwork' },
  { name: 'Speechmatics',      api_type: 'greenhouse',    api_slug: 'speechmatics' },
  { name: 'Black Forest Labs',  api_type: 'greenhouse',    api_slug: 'blackforestlabs' },
  { name: 'Helsing',           api_type: 'greenhouse',    api_slug: 'helsing' },
  { name: 'Celonis',           api_type: 'greenhouse',    api_slug: 'celonis' },
  { name: 'Contentful',        api_type: 'greenhouse',    api_slug: 'contentful' },
  { name: 'N26',               api_type: 'greenhouse',    api_slug: 'n26' },
  { name: 'SumUp',             api_type: 'greenhouse',    api_slug: 'sumup' },
  { name: 'Wayve',             api_type: 'greenhouse',    api_slug: 'wayve' },
  { name: 'Stability AI',      api_type: 'greenhouse',    api_slug: 'stabilityai' },
  { name: 'Isomorphic Labs',   api_type: 'greenhouse',    api_slug: 'isomorphiclabs' },
  { name: 'Amplemarket',       api_type: 'greenhouse',    api_slug: 'amplemarket' },
  // Greenhouse EU
  { name: 'PolyAI',            api_type: 'greenhouse_eu', api_slug: 'polyai' },
  { name: 'Parloa',            api_type: 'greenhouse_eu', api_slug: 'parloa' },
  { name: 'Scandit',           api_type: 'greenhouse_eu', api_slug: 'scandit' },
  { name: 'Trade Republic',    api_type: 'greenhouse_eu', api_slug: 'traderepublicbank' },
  // Ashby
  { name: 'ElevenLabs',        api_type: 'ashby',         api_slug: 'elevenlabs' },
  { name: 'Deepgram',          api_type: 'ashby',         api_slug: 'deepgram' },
  { name: 'Vapi',              api_type: 'ashby',         api_slug: 'vapi' },
  { name: 'Bland AI',          api_type: 'ashby',         api_slug: 'bland' },
  { name: 'Cohere',            api_type: 'ashby',         api_slug: 'cohere' },
  { name: 'LangChain',         api_type: 'ashby',         api_slug: 'langchain' },
  { name: 'Pinecone',          api_type: 'ashby',         api_slug: 'pinecone' },
  { name: 'n8n',               api_type: 'ashby',         api_slug: 'n8n' },
  { name: 'Zapier',            api_type: 'ashby',         api_slug: 'zapier' },
  { name: 'Attio',             api_type: 'ashby',         api_slug: 'attio' },
  { name: 'Aleph Alpha',       api_type: 'ashby',         api_slug: 'AlephAlpha' },
  { name: 'DeepL',             api_type: 'ashby',         api_slug: 'DeepL' },
  { name: 'Synthesia',         api_type: 'ashby',         api_slug: 'synthesia' },
  { name: 'Lovable',           api_type: 'ashby',         api_slug: 'lovable' },
  // Lever
  { name: 'Mistral AI',        api_type: 'lever',         api_slug: 'mistral' },
  { name: 'Weights & Biases',  api_type: 'lever',         api_slug: 'wandb' },
  { name: 'Palantir',          api_type: 'lever',         api_slug: 'palantir' },
  { name: 'Qonto',             api_type: 'lever',         api_slug: 'qonto' },
  { name: 'Spotify',           api_type: 'lever',         api_slug: 'spotify' },
  { name: 'Vinted',            api_type: 'lever',         api_slug: 'vinted' },
];

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
  switch (api_type) {
    case 'greenhouse':
      return `https://boards-api.greenhouse.io/v1/boards/${api_slug}/jobs`;
    case 'greenhouse_eu':
      return `https://boards-api.eu.greenhouse.io/v1/boards/${api_slug}/jobs`;
    case 'ashby':
      return `https://api.ashbyhq.com/posting-api/job-board/${api_slug}/jobPostings`;
    case 'lever':
      return `https://api.lever.co/v0/postings/${api_slug}?mode=json`;
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
        'INSERT INTO scanner_companies (user_id, name, api_type, api_slug, enabled) VALUES ($1,$2,$3,$4,TRUE)',
        [userId, c.name, c.api_type, c.api_slug]
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
  const { name, api_type, api_slug } = req.body;
  if (!name || !api_type || !api_slug) {
    return res.status(400).json({ error: 'name, api_type, api_slug required' });
  }
  const validTypes = ['greenhouse', 'greenhouse_eu', 'ashby', 'lever'];
  if (!validTypes.includes(api_type)) {
    return res.status(400).json({ error: `api_type must be one of: ${validTypes.join(', ')}` });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO scanner_companies (user_id, name, api_type, api_slug, enabled)
       VALUES ($1,$2,$3,$4,TRUE) RETURNING *`,
      [req.user.id, name.trim(), api_type, api_slug.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/scanner/companies/:id
router.patch('/companies/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, api_type, api_slug, enabled } = req.body;
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
    if (api_slug !== undefined)  { fields.push(`api_slug=$${idx++}`);  vals.push(api_slug); }
    if (enabled !== undefined)   { fields.push(`enabled=$${idx++}`);   vals.push(enabled); }
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

    // Load user's saved CV for auto-evaluation
    const { rows: cvRows } = await pool.query(
      'SELECT content_md FROM cvs WHERE user_id=$1',
      [userId]
    );
    const cvContent = cvRows[0]?.content_md ?? null;
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
            keywords.length > 0 ? keywords : null,
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
        console.error(`Scanner eval error for ${job.title} @ ${job.company}:`, evalErr.message);
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
    console.error('scanner/run error:', err);
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

export default router;
