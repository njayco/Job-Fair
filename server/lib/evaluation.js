import Anthropic from '@anthropic-ai/sdk';
import dns from 'dns/promises';
import net from 'net';

// SSRF protection: check if an IP address is in a private/reserved range
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b, c] = parts;
    return (
      a === 127 ||                              // loopback
      a === 10 ||                               // RFC1918 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||      // RFC1918 172.16.0.0/12
      (a === 192 && b === 168) ||               // RFC1918 192.168.0.0/16
      (a === 169 && b === 254) ||               // link-local / AWS metadata
      (a === 100 && b >= 64 && b <= 127) ||     // CGNAT / Tailscale
      a === 0 ||                                // 0.0.0.0/8
      a >= 224                                  // multicast / reserved
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' ||                        // loopback
      lower.startsWith('fc') ||                 // ULA (RFC4193)
      lower.startsWith('fd') ||
      lower.startsWith('fe80') ||               // link-local
      lower.startsWith('::ffff:') ||            // IPv4-mapped — recheck below
      lower === '::' ||
      lower.startsWith('100::')                 // discard prefix
    );
  }
  return false;
}

async function validateAndResolveUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format. Please provide a valid https:// job URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are allowed.');
  }

  const hostname = parsed.hostname;

  // Block IPs directly in the hostname
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Job URL must point to a public website, not an internal address.');
    }
    return rawUrl;
  }

  // Resolve DNS and validate all resolved IPs
  let addresses;
  try {
    addresses = await dns.resolve(hostname);
  } catch {
    throw new Error(`Could not resolve hostname "${hostname}". Please check the URL.`);
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new Error('Job URL resolves to a private or reserved IP address. Only public job sites are allowed.');
    }
  }

  return rawUrl;
}

// Support both Replit AI integration key and user-provided Anthropic key
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  ...(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY
    ? { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL }
    : {}),
});

const SYSTEM_PROMPT = `You are an expert career coach and job evaluation specialist. Your job is to evaluate job offers against a candidate's CV and background.

You evaluate job offers across 6 blocks (A-F) using a 1-5 scoring system:
- 4.5+ = Strong match, apply immediately
- 4.0-4.4 = Good match, worth applying
- 3.5-3.9 = Decent, apply only with specific reason
- Below 3.5 = Not recommended

The 6 archetypes you classify roles into:
1. AI Platform / LLMOps Engineer - Key signals: observability, evals, pipelines, monitoring, reliability
2. Agentic Workflows / Automation - Key signals: agent, HITL, orchestration, workflow, multi-agent
3. Technical AI Product Manager - Key signals: PRD, roadmap, discovery, stakeholder, product manager
4. AI Solutions Architect - Key signals: architecture, enterprise, integration, design, systems
5. AI Forward Deployed Engineer - Key signals: client-facing, deploy, prototype, fast delivery, field
6. AI Transformation Lead - Key signals: change management, adoption, enablement, transformation

Scoring dimensions:
- Match with CV (skills, experience, proof points alignment)
- North Star alignment (how well the role fits target archetypes)
- Comp (salary vs market: 5=top quartile, 1=well below)
- Cultural signals (company culture, growth, stability, remote policy)
- Red flags (blockers, warnings — negative adjustments)
- Global (weighted average)

IMPORTANT: Always respond with valid JSON matching the exact schema requested. Never fabricate metrics or experience not present in the CV.`;

function buildEvaluationPrompt(jobDescription, cvContent) {
  return `Evaluate this job offer against the candidate's CV. Return ONLY a valid JSON object — no markdown, no explanation.

## Candidate CV:
${cvContent}

## Job Description:
${jobDescription}

Return this exact JSON structure:
{
  "archetype": "one of the 6 archetypes",
  "archetype_secondary": "second archetype if hybrid, or null",
  "score": {
    "cv_match": 0.0,
    "north_star": 0.0,
    "comp": 0.0,
    "cultural": 0.0,
    "red_flags": 0.0,
    "global": 0.0
  },
  "block_a": {
    "archetype": "detected archetype",
    "domain": "platform/agentic/LLMOps/ML/enterprise",
    "function": "build/consult/manage/deploy",
    "seniority": "Junior/Mid/Senior/Staff/Principal/Director",
    "remote": "Full remote/Hybrid/On-site",
    "team_size": "approximate or null",
    "tldr": "1 sentence summary of the role"
  },
  "block_b": {
    "matches": [
      {"requirement": "JD requirement", "cv_match": "exact CV line or experience", "strength": "strong/partial/weak"}
    ],
    "gaps": [
      {"gap": "requirement not met", "severity": "blocker/nice-to-have", "mitigation": "how to address this gap"}
    ]
  },
  "block_c": {
    "level_detected": "seniority level in JD",
    "candidate_level": "candidate's natural level for this archetype",
    "senior_pitch": "how to position as senior without fabricating",
    "downlevel_plan": "what to do if they offer a lower level"
  },
  "block_d": {
    "salary_range": "estimated range based on market data",
    "market_position": "top quartile/above market/median/below market",
    "company_comp_reputation": "brief description",
    "demand_trend": "growing/stable/declining"
  },
  "block_e": {
    "cv_changes": [
      {"section": "CV section name", "current": "current content summary", "proposed": "proposed change", "reason": "why"}
    ],
    "linkedin_changes": [
      {"section": "LinkedIn section", "change": "what to change", "reason": "why"}
    ]
  },
  "block_f": {
    "star_stories": [
      {"requirement": "JD requirement", "story": "STAR story title", "situation": "S", "task": "T", "action": "A", "result": "R", "reflection": "what was learned"}
    ],
    "recommended_case_study": "which project to present and how",
    "red_flag_questions": [
      {"question": "tough question", "response": "how to handle it"}
    ]
  },
  "keywords": ["keyword1", "keyword2"],
  "company": "company name extracted from JD",
  "role": "job title extracted from JD",
  "recommendation": "APPLY / CONSIDER / SKIP",
  "recommendation_reason": "1-2 sentence reason for recommendation"
}`;
}

export async function fetchJobDescription(url) {
  // Validate URL and guard against SSRF before making any network request
  await validateAndResolveUrl(url);

  const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB max

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CareerOps/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    // Do NOT follow redirects automatically — re-validate redirect targets
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });

  // Handle redirects safely: validate the redirect destination before following
  if (response.status >= 300 && response.status < 400) {
    const redirectUrl = response.headers.get('location');
    if (!redirectUrl) {
      throw new Error('Server redirected without a Location header.');
    }
    // Resolve relative redirect against original URL
    const absoluteRedirect = new URL(redirectUrl, url).toString();
    await validateAndResolveUrl(absoluteRedirect);
    // Follow the validated redirect (one hop only)
    const redirected = await fetch(absoluteRedirect, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CareerOps/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!redirected.ok) {
      throw new Error(`Failed to fetch job URL after redirect: HTTP ${redirected.status}`);
    }
    // Check content-type
    const ct = redirected.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('text/plain') && !ct.includes('application/xhtml')) {
      throw new Error('Job URL does not appear to contain readable text content.');
    }
    const raw = await redirected.text();
    if (raw.length > MAX_RESPONSE_BYTES) {
      throw new Error('Job URL response is too large. Please paste the job description directly.');
    }
    return extractTextFromHtml(raw);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch job URL: HTTP ${response.status}`);
  }

  // Check content-type
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
    throw new Error('Job URL does not appear to contain readable text content. Please paste the job description directly.');
  }

  const html = await response.text();
  if (html.length > MAX_RESPONSE_BYTES) {
    throw new Error('Job URL response is too large. Please paste the job description directly.');
  }

  return extractTextFromHtml(html);
}

function extractTextFromHtml(html) {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n\n')
    .trim();

  if (text.length < 100) {
    throw new Error('Could not extract meaningful content from the job URL. Please paste the job description directly.');
  }

  // Return up to 8000 chars to fit in the prompt
  return text.slice(0, 8000);
}

export async function evaluateJob(jobDescription, cvContent) {
  const prompt = buildEvaluationPrompt(jobDescription, cvContent);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0]?.text || '';

  // Strip markdown code blocks if present
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
    responseText.match(/(\{[\s\S]*\})/);

  const jsonStr = jsonMatch ? jsonMatch[1] : responseText;

  let evaluation;
  try {
    evaluation = JSON.parse(jsonStr.trim());
  } catch (e) {
    throw new Error(`Failed to parse evaluation response: ${e.message}`);
  }

  return evaluation;
}

export async function generateReportMarkdown(evaluation, jobUrl) {
  const date = new Date().toISOString().split('T')[0];
  const score = evaluation.score?.global?.toFixed(2) || 'N/A';
  const archetype = evaluation.archetype || 'Unknown';
  const company = evaluation.company || 'Unknown Company';
  const role = evaluation.role || 'Unknown Role';

  const matchRows = (evaluation.block_b?.matches || [])
    .map(m => `| ${m.requirement} | ${m.cv_match} | ${m.strength} |`)
    .join('\n');

  const gapRows = (evaluation.block_b?.gaps || [])
    .map(g => `| ${g.gap} | ${g.severity} | ${g.mitigation} |`)
    .join('\n');

  const starRows = (evaluation.block_f?.star_stories || [])
    .map((s, i) => `| ${i + 1} | ${s.requirement} | ${s.story} | ${s.situation} | ${s.task} | ${s.action} | ${s.result} | ${s.reflection} |`)
    .join('\n');

  const keywords = (evaluation.keywords || []).join(', ');

  return `# Evaluation: ${company} — ${role}

**Date:** ${date}
**Archetype:** ${archetype}
**Score:** ${score}/5
**URL:** ${jobUrl || 'N/A'}
**Recommendation:** ${evaluation.recommendation || 'N/A'}

---

## A) Role Summary

| Field | Value |
|-------|-------|
| **Archetype** | ${evaluation.block_a?.archetype || archetype} |
| **Domain** | ${evaluation.block_a?.domain || 'N/A'} |
| **Function** | ${evaluation.block_a?.function || 'N/A'} |
| **Seniority** | ${evaluation.block_a?.seniority || 'N/A'} |
| **Remote** | ${evaluation.block_a?.remote || 'N/A'} |
| **Team size** | ${evaluation.block_a?.team_size || 'N/A'} |
| **TL;DR** | ${evaluation.block_a?.tldr || 'N/A'} |

## B) CV Match

| JD Requirement | CV Match | Strength |
|----------------|----------|----------|
${matchRows || '| No data | - | - |'}

### Gaps

| Gap | Severity | Mitigation |
|-----|----------|------------|
${gapRows || '| No significant gaps | - | - |'}

## C) Level & Strategy

**Level detected:** ${evaluation.block_c?.level_detected || 'N/A'}
**Candidate level:** ${evaluation.block_c?.candidate_level || 'N/A'}

**Senior pitch:** ${evaluation.block_c?.senior_pitch || 'N/A'}

**If downleveled:** ${evaluation.block_c?.downlevel_plan || 'N/A'}

## D) Comp & Demand

| Metric | Value |
|--------|-------|
| **Salary range** | ${evaluation.block_d?.salary_range || 'N/A'} |
| **Market position** | ${evaluation.block_d?.market_position || 'N/A'} |
| **Company comp reputation** | ${evaluation.block_d?.company_comp_reputation || 'N/A'} |
| **Demand trend** | ${evaluation.block_d?.demand_trend || 'N/A'} |

## E) Personalization Plan

### CV Changes
${(evaluation.block_e?.cv_changes || []).map((c, i) => `${i + 1}. **${c.section}**: ${c.proposed} _(${c.reason})_`).join('\n') || 'N/A'}

### LinkedIn Changes
${(evaluation.block_e?.linkedin_changes || []).map((c, i) => `${i + 1}. **${c.section}**: ${c.change} _(${c.reason})_`).join('\n') || 'N/A'}

## F) Interview Plan

| # | JD Requirement | Story | S | T | A | R | Reflection |
|---|----------------|-------|---|---|---|---|------------|
${starRows || '| 1 | - | - | - | - | - | - | - |'}

**Recommended case study:** ${evaluation.block_f?.recommended_case_study || 'N/A'}

---

## Keywords

${keywords}
`;
}
