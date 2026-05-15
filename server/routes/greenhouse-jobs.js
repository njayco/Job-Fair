import { Router } from 'express';
import { anthropicClient, MODEL } from '../lib/evaluation.js';
import pool from '../db.js';

const router = Router();

// Implementation note: the task originally suggested inspecting my.greenhouse.io/jobs
// as a primary search path. That endpoint requires authentication (redirects to sign-in)
// and has no documented public API. The Greenhouse Job Board API
// (boards-api.greenhouse.io/v1/boards/{token}/jobs) is the official public API for
// fetching jobs from individual company boards, and is the standard integration path.
// We query a curated list of board tokens in parallel, filter by keyword relevance,
// and score the top candidates with Claude — functionally equivalent to a search.

// Curated list of well-known Greenhouse board tokens
// Format: [token, display_name] — display_name used when company can't be parsed from job data
const GREENHOUSE_BOARDS = [
  ['airbnb', 'Airbnb'],
  ['anthropic', 'Anthropic'],
  ['airtable', 'Airtable'],
  ['amplitude', 'Amplitude'],
  ['asana', 'Asana'],
  ['brex', 'Brex'],
  ['canva', 'Canva'],
  ['checkr', 'Checkr'],
  ['chime', 'Chime'],
  ['cisco', 'Cisco'],
  ['cloudflare', 'Cloudflare'],
  ['coinbase', 'Coinbase'],
  ['confluent', 'Confluent'],
  ['databricks', 'Databricks'],
  ['datadog', 'Datadog'],
  ['discord', 'Discord'],
  ['dropbox', 'Dropbox'],
  ['duolingo', 'Duolingo'],
  ['elastic', 'Elastic'],
  ['etsy', 'Etsy'],
  ['figma', 'Figma'],
  ['flexport', 'Flexport'],
  ['gong', 'Gong'],
  ['hashicorp', 'HashiCorp'],
  ['hubspot', 'HubSpot'],
  ['instacart', 'Instacart'],
  ['intercom', 'Intercom'],
  ['lattice', 'Lattice'],
  ['linear', 'Linear'],
  ['lyft', 'Lyft'],
  ['mixpanel', 'Mixpanel'],
  ['mongodb', 'MongoDB'],
  ['notion', 'Notion'],
  ['okta', 'Okta'],
  ['openai', 'OpenAI'],
  ['palantir', 'Palantir'],
  ['pendo', 'Pendo'],
  ['pinterest', 'Pinterest'],
  ['plaid', 'Plaid'],
  ['postman', 'Postman'],
  ['quora', 'Quora'],
  ['reddit', 'Reddit'],
  ['retool', 'Retool'],
  ['rippling', 'Rippling'],
  ['robinhood', 'Robinhood'],
  ['roblox', 'Roblox'],
  ['salesforce', 'Salesforce'],
  ['scale', 'Scale AI'],
  ['segment', 'Segment'],
  ['sendbird', 'Sendbird'],
  ['sentry', 'Sentry'],
  ['servicenow', 'ServiceNow'],
  ['shopify', 'Shopify'],
  ['slack', 'Slack'],
  ['snyk', 'Snyk'],
  ['sofi', 'SoFi'],
  ['sourcegraph', 'Sourcegraph'],
  ['splunk', 'Splunk'],
  ['square', 'Square'],
  ['squarespace', 'Squarespace'],
  ['stripe', 'Stripe'],
  ['superhuman', 'Superhuman'],
  ['tailscale', 'Tailscale'],
  ['thumbtack', 'Thumbtack'],
  ['tiktok', 'TikTok'],
  ['toast', 'Toast'],
  ['twilio', 'Twilio'],
  ['twitch', 'Twitch'],
  ['twitter', 'Twitter/X'],
  ['uber', 'Uber'],
  ['unity3d', 'Unity'],
  ['vanta', 'Vanta'],
  ['verkada', 'Verkada'],
  ['vercel', 'Vercel'],
  ['wayfair', 'Wayfair'],
  ['webflow', 'Webflow'],
  ['wealthsimple', 'Wealthsimple'],
  ['wish', 'Wish'],
  ['workday', 'Workday'],
  ['wunderkind', 'Wunderkind'],
  ['yelp', 'Yelp'],
  ['zapier', 'Zapier'],
  ['zendesk', 'Zendesk'],
  ['zoom', 'Zoom'],
  ['zscaler', 'Zscaler'],
];

const GH_BASE = 'https://boards-api.greenhouse.io/v1/boards';
const FETCH_TIMEOUT_MS = 8000;
const MAX_BOARDS_PER_SEARCH = 60;
const MAX_RESULTS_TO_SCORE = 15;

// Fetch all jobs for a single board token
async function fetchBoardJobs(token, companyName) {
  try {
    const res = await fetch(`${GH_BASE}/${token}/jobs?content=true`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || []).map(job => ({
      id: String(job.id),
      token,
      company: companyName,
      title: job.title || '',
      location: job.location?.name || '',
      url: job.absolute_url || `https://boards.greenhouse.io/${token}/jobs/${job.id}`,
      description: (job.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000),
      updated_at: job.updated_at || '',
      departments: (job.departments || []).map(d => d.name).filter(Boolean),
    }));
  } catch {
    return [];
  }
}

// Simple keyword relevance score (0–1) for pre-filtering before Claude scoring
function keywordScore(job, tokens) {
  if (!tokens.length) return 1;
  const haystack = `${job.title} ${job.location} ${job.company} ${job.departments.join(' ')} ${job.description.slice(0, 500)}`.toLowerCase();
  let hits = 0;
  for (const tok of tokens) {
    if (haystack.includes(tok)) hits++;
  }
  return hits / tokens.length;
}

// Tokenise the query into meaningful terms (skip short stop-words)
function tokeniseQuery(query) {
  const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'in', 'at', 'for', 'of', 'to', 'with', 'on', 'job', 'jobs', 'role', 'roles', 'position']);
  return query.toLowerCase().split(/\W+/).filter(t => t.length > 2 && !STOP.has(t));
}

function buildGreenhouseScoringPrompt(cvContent, jobs, query, location, workStyle) {
  const prefs = [
    query ? `Role/keyword: ${query}` : '',
    location ? `Location preference: ${location}` : '',
    workStyle ? `Work style: ${workStyle}` : '',
  ].filter(Boolean).join('\n');

  const jobList = jobs.map((j, i) => `
--- JOB ${i + 1} ---
URL: ${j.url}
Title: ${j.title}
Company: ${j.company}
Location: ${j.location}
Departments: ${j.departments.join(', ') || 'N/A'}
Description:
${j.description.slice(0, 3500)}
`).join('\n');

  return `You are an expert career strategist. Score each Greenhouse job posting against the candidate's CV.

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
    "company": "company name",
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
- Use salary from posting if stated; otherwise estimate from market data for the role/location
- Base all bullets on specific evidence from the candidate's CV
- Set remote_ok true if the posting mentions remote, distributed, or anywhere
- Return ONLY the JSON array — no markdown fences, no explanation`;
}

// POST /api/greenhouse-jobs
router.post('/', async (req, res) => {
  try {
    const { query = '', location = '', work_style = '', cv_content: cvFromBody } = req.body;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a role or keyword to search for.', code: 'NO_QUERY' });
    }

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

    const queryTokens = tokeniseQuery(query);

    // Location filter: if location specified, also include boards that commonly have remote/distributed roles
    const locationLower = (location || '').toLowerCase().trim();

    // Fetch jobs from boards in parallel batches
    // Limit to MAX_BOARDS_PER_SEARCH boards to keep latency reasonable
    const boardsToFetch = GREENHOUSE_BOARDS.slice(0, MAX_BOARDS_PER_SEARCH);
    console.log(`Greenhouse: fetching jobs from ${boardsToFetch.length} boards for query "${query}"`);

    const boardResults = await Promise.allSettled(
      boardsToFetch.map(([token, name]) => fetchBoardJobs(token, name))
    );

    const allJobs = [];
    let totalFetched = 0;
    for (const result of boardResults) {
      if (result.status === 'fulfilled') {
        totalFetched += result.value.length;
        allJobs.push(...result.value);
      }
    }

    console.log(`Greenhouse: fetched ${totalFetched} total jobs from ${boardsToFetch.length} boards`);

    if (!allJobs.length) {
      return res.status(400).json({
        error: 'Could not reach Greenhouse job boards. Please try again.',
        code: 'FETCH_ERROR',
      });
    }

    // Score relevance and filter
    let candidates = allJobs
      .map(j => ({ ...j, _score: keywordScore(j, queryTokens) }))
      .filter(j => j._score > 0);

    // If no keyword matches, return a broad sample (all jobs, sorted randomly)
    if (!candidates.length) {
      candidates = allJobs.map(j => ({ ...j, _score: Math.random() }));
    }

    // Apply location filter if specified (soft filter: prefer matching, don't exclude entirely)
    if (locationLower) {
      const withLocation = candidates.filter(j =>
        j.location.toLowerCase().includes(locationLower) ||
        j.location.toLowerCase().includes('remote') ||
        j.location.toLowerCase().includes('anywhere')
      );
      if (withLocation.length >= 5) {
        candidates = withLocation;
      }
    }

    // Apply work_style filter
    if (work_style === 'remote') {
      const remoteJobs = candidates.filter(j =>
        j.location.toLowerCase().includes('remote') ||
        j.location.toLowerCase().includes('anywhere') ||
        j.description.toLowerCase().includes('remote')
      );
      if (remoteJobs.length >= 5) candidates = remoteJobs;
    }

    // Sort by keyword relevance, then cap
    candidates.sort((a, b) => b._score - a._score);
    const toScore = candidates.slice(0, MAX_RESULTS_TO_SCORE);

    console.log(`Greenhouse: scoring ${toScore.length} jobs with Claude`);

    // Claude scoring
    const scoringPrompt = buildGreenhouseScoringPrompt(cvContent, toScore, query, location, work_style);
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
      .map((j, i) => {
        const sourceJob = toScore[Number(j.index ?? i + 1) - 1] || toScore[i] || {};
        return {
          index: Number(j.index ?? i + 1),
          role: String(j.role || sourceJob.title || 'Unknown Role'),
          company: String(j.company || sourceJob.company || 'Unknown Company'),
          url: String(j.url || sourceJob.url || ''),
          location: String(j.location || sourceJob.location || 'Unknown'),
          remote_ok: Boolean(j.remote_ok),
          match_pct: Math.min(99, Math.max(0, Math.round(Number(j.match_pct)))),
          why_match: Array.isArray(j.why_match) ? j.why_match.map(String) : [],
          skill_gaps: Array.isArray(j.skill_gaps) ? j.skill_gaps.map(String) : [],
          comp_low: j.comp_low ? Number(j.comp_low) : null,
          comp_high: j.comp_high ? Number(j.comp_high) : null,
          description: String(j.description || ''),
          full_text: String(sourceJob.description || '').slice(0, 6000),
          source: 'greenhouse',
        };
      })
      .sort((a, b) => b.match_pct - a.match_pct);

    const preferences = { query, location, work_style };

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
    console.error('POST /api/greenhouse-jobs error:', err);
    res.status(500).json({ error: err.message || 'Greenhouse job search failed. Please try again.' });
  }
});

export default router;
