import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// Curated list of well-known Greenhouse board tokens
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
const MAX_RESULTS = 25;
const BOARD_CACHE_TTL_MS = process.env.GREENHOUSE_BOARD_CACHE_TTL_MS
  ? Number(process.env.GREENHOUSE_BOARD_CACHE_TTL_MS)
  : 10 * 60 * 1000;

// In-memory cache: token → { jobs: Array, expiresAt: number }
const boardCache = new Map();

async function fetchBoardJobs(token, companyName) {
  const now = Date.now();
  const cached = boardCache.get(token);
  if (cached && cached.expiresAt > now) return cached.jobs;

  try {
    const res = await fetch(`${GH_BASE}/${token}/jobs?content=true`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = (data.jobs || []).map(job => ({
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
    boardCache.set(token, { jobs, expiresAt: now + BOARD_CACHE_TTL_MS });
    return jobs;
  } catch {
    return [];
  }
}

function keywordScore(job, tokens) {
  if (!tokens.length) return 1;
  const haystack = `${job.title} ${job.location} ${job.company} ${job.departments.join(' ')} ${job.description.slice(0, 500)}`.toLowerCase();
  let hits = 0;
  for (const tok of tokens) {
    if (haystack.includes(tok)) hits++;
  }
  return hits / tokens.length;
}

function tokeniseQuery(query) {
  const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'in', 'at', 'for', 'of', 'to', 'with', 'on', 'job', 'jobs', 'role', 'roles', 'position']);
  return query.toLowerCase().split(/\W+/).filter(t => t.length > 2 && !STOP.has(t));
}

// POST /api/greenhouse-jobs
router.post('/', async (req, res) => {
  try {
    const { query = '', location = '', work_style = '', cv_content: cvFromBody } = req.body;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a role or keyword to search for.', code: 'NO_QUERY' });
    }

    // Optionally save CV if provided (used by Evaluate Fit later)
    if (cvFromBody && typeof cvFromBody === 'string' && cvFromBody.trim().length >= 50) {
      pool.query(
        `INSERT INTO cvs (user_id, content_md) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET content_md = EXCLUDED.content_md, updated_at = NOW()`,
        [req.user.id, cvFromBody.trim()]
      ).catch(e => console.error('CV upsert warning:', e.message));
    }

    const queryTokens = tokeniseQuery(query);
    const locationLower = (location || '').toLowerCase().trim();

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

    // Keyword filter and score
    let candidates = allJobs
      .map(j => ({ ...j, _score: keywordScore(j, queryTokens) }))
      .filter(j => j._score > 0);

    if (!candidates.length) {
      candidates = allJobs.map(j => ({ ...j, _score: Math.random() }));
    }

    // Location filter (soft)
    if (locationLower) {
      const withLocation = candidates.filter(j =>
        j.location.toLowerCase().includes(locationLower) ||
        j.location.toLowerCase().includes('remote') ||
        j.location.toLowerCase().includes('anywhere')
      );
      if (withLocation.length >= 5) candidates = withLocation;
    }

    // Work style filter
    if (work_style === 'remote') {
      const remoteJobs = candidates.filter(j =>
        j.location.toLowerCase().includes('remote') ||
        j.location.toLowerCase().includes('anywhere') ||
        j.description.toLowerCase().includes('remote')
      );
      if (remoteJobs.length >= 5) candidates = remoteJobs;
    }

    // Sort by keyword relevance and take top N
    candidates.sort((a, b) => b._score - a._score);
    const top = candidates.slice(0, MAX_RESULTS);

    console.log(`Greenhouse: returning ${top.length} results`);

    const results = top.map((job, i) => {
      const locLower = job.location.toLowerCase();
      const descLower = job.description.toLowerCase();
      const remote_ok = locLower.includes('remote') || locLower.includes('anywhere') || descLower.includes('remote');
      return {
        index: i + 1,
        role: job.title,
        company: job.company,
        url: job.url,
        location: job.location || 'Location not specified',
        remote_ok,
        departments: job.departments,
        description: job.description.slice(0, 600),
        full_text: job.description,
        match_pct: 0,
        why_match: [],
        skill_gaps: [],
        comp_low: null,
        comp_high: null,
        source: 'greenhouse',
      };
    });

    const preferences = { query, location, work_style };

    const insertResult = await pool.query(
      `INSERT INTO job_finder_runs (user_id, preferences, results)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [req.user.id, JSON.stringify(preferences), JSON.stringify(results)]
    );

    res.json({
      id: insertResult.rows[0].id,
      created_at: insertResult.rows[0].created_at,
      preferences,
      results,
    });

  } catch (err) {
    console.error('POST /api/greenhouse-jobs error:', err);
    res.status(500).json({ error: err.message || 'Greenhouse job search failed. Please try again.' });
  }
});

export default router;
