/**
 * applyDrafter.js
 * Uses Claude to:
 *  - Draft form field answers based on the user's CV and evaluation data
 *  - Generate a tailored/optimized resume for the specific role
 *  - Write a compelling cover letter
 */

import { anthropicClient, MODEL } from './evaluation.js';

// ── Field answer drafter ──────────────────────────────────────────────────────

export async function draftApplicationAnswers({
  fields,
  cvContent,
  evaluationJson,
  company,
  role,
  jobUrl,
}) {
  const company_ = company || evaluationJson?.company || 'the company';
  const role_ = role || evaluationJson?.role || 'this role';

  const starStories = (evaluationJson?.block_f?.star_stories || [])
    .slice(0, 3)
    .map(s => `• ${s.requirement}: ${s.story} — S: ${s.situation} | A: ${s.action} | R: ${s.result}`)
    .join('\n');

  const tldr = evaluationJson?.block_a?.tldr || '';
  const recommendationReason = evaluationJson?.recommendation_reason || '';
  const cvChanges = (evaluationJson?.block_e?.cv_changes || [])
    .slice(0, 3)
    .map(c => `• ${c.section}: ${c.proposed}`)
    .join('\n');

  const fieldList = fields
    .map((f, i) => `${i + 1}. "${f.label}" (type: ${f.type}${f.required ? ', REQUIRED' : ''})${f.placeholder ? ` — hint: ${f.placeholder}` : ''}`)
    .join('\n');

  const prompt = `You are an expert job application assistant helping a candidate apply for a role.

## Target Role
Title: ${role_}
Company: ${company_}
${jobUrl ? `URL: ${jobUrl}` : ''}
${tldr ? `Role summary: ${tldr}` : ''}
${recommendationReason ? `Fit summary: ${recommendationReason}` : ''}

## Candidate CV
${cvContent.slice(0, 5000)}

## STAR Stories (from evaluation — use as evidence)
${starStories || '(none available)'}

## CV Tailoring Suggestions
${cvChanges || '(none available)'}

## Application Form Fields
${fieldList}

## Instructions
Draft a proposed answer for EACH field. Rules:
- For name, email, phone, LinkedIn, website: extract directly from the CV. If not found, leave empty string.
- For "cover letter" or "letter of motivation": write 150–200 words using STAR stories and 1–2 specific facts from the company context. Close with enthusiasm.
- For "why this company" / "why this role": write 2–4 sentences, referencing the role's domain and something specific about the company.
- For "work authorization" / "eligible to work": respond "Yes, I am authorized to work" unless CV indicates otherwise.
- For "salary", "compensation", "expected salary": leave empty string — the candidate will decide.
- For "resume" / "CV" / file upload fields: respond with "Uploaded separately".
- For custom open-ended questions: use CV evidence + STAR story fragments. Keep under 100 words unless it's a cover letter field.
- NEVER fabricate facts not present in the CV or evaluation.
- Write in first person, professional tone, in the same language as the field labels.

Return ONLY valid JSON — an array with one object per field, in the same order as the field list:
[
  { "label": "exact field label", "proposed_value": "your draft answer" },
  ...
]`;

  const message = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0]?.text || '[]';

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\[[\s\S]*\])/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  let answers = [];
  try {
    answers = JSON.parse(jsonStr.trim());
  } catch (e) {
    console.warn('[applyDrafter] Failed to parse Claude response:', e.message);
    answers = [];
  }

  const answerMap = {};
  for (const a of answers) {
    if (a.label) answerMap[a.label.toLowerCase()] = a.proposed_value || '';
  }

  return fields.map(f => ({
    ...f,
    proposed_value: answerMap[f.label.toLowerCase()] ?? '',
    approved_value: answerMap[f.label.toLowerCase()] ?? '',
  }));
}

// ── Resume tailoring ──────────────────────────────────────────────────────────

export async function tailorResume({ cvContent, evaluationJson, company, role }) {
  const company_ = company || 'the company';
  const role_ = role || 'this role';

  const tldr = evaluationJson?.block_a?.tldr || '';
  const requirements = (evaluationJson?.block_b?.matches || [])
    .slice(0, 8)
    .map(m => `• ${m.requirement}${(m.strength === 'strong' || m.met) ? ' [matched]' : ' [partial]'}`)
    .join('\n');
  const gaps = (evaluationJson?.block_b?.gaps || [])
    .filter(g => g.severity !== 'blocker')
    .slice(0, 4)
    .map(g => `• ${g.gap}${g.mitigation ? ` → suggest: ${g.mitigation}` : ''}`)
    .join('\n');
  const cvChanges = (evaluationJson?.block_e?.cv_changes || [])
    .slice(0, 6)
    .map(c => `• ${c.section}: change "${(c.current || '').slice(0, 60)}…" → "${(c.proposed || '').slice(0, 100)}…"`)
    .join('\n');
  const starHighlights = (evaluationJson?.block_f?.star_stories || [])
    .slice(0, 3)
    .map(s => `• ${s.requirement}: ${s.result || s.story || ''}`)
    .join('\n');

  const prompt = `You are an expert CV editor and career strategist. Produce a tailored version of this CV optimized for a specific job application.

## Target Position
Role: ${role_}
Company: ${company_}
${tldr ? `What the role needs: ${tldr}` : ''}

## Key Requirements (from AI evaluation)
${requirements || '(not available)'}

## Gaps to Address
${gaps || '(none)'}

## Recommended CV Changes
${cvChanges || '(none)'}

## Top Achievements to Highlight
${starHighlights || '(not available)'}

## Original CV
${cvContent}

## Instructions
Produce a polished, tailored version of this CV:
1. Rewrite the professional summary (2–3 sentences) to speak directly to this role — reference the specific domain, key skill, or value proposition the employer cares about.
2. Apply every recommended change listed above.
3. In each work experience entry, reorder bullet points so the most role-relevant achievements appear first.
4. Naturally weave in keywords from the requirements where they already reflect real experience — do NOT add skills the candidate does not have.
5. Sharpen any weak bullet points using the STAR highlights where applicable.
6. Keep every date, company name, title, and factual claim exactly as in the original — do NOT fabricate anything.
7. Preserve the original markdown structure and section headings exactly.

Return ONLY the tailored CV in exactly the same markdown format as the original. No commentary, no preamble.`;

  const message = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0]?.text?.trim() || cvContent;
}

// ── Cover letter generator ────────────────────────────────────────────────────

export async function generateCoverLetter({ cvContent, evaluationJson, company, role, jobUrl }) {
  const company_ = company || 'the company';
  const role_ = role || 'this role';

  const nameMatch = cvContent.match(/^#\s+(.+)$/m);
  const candidateName = nameMatch ? nameMatch[1].trim() : '';

  const tldr = evaluationJson?.block_a?.tldr || '';
  const recommendationReason = evaluationJson?.recommendation_reason || '';

  const strongMatches = (evaluationJson?.block_b?.matches || [])
    .filter(m => (m.strength === 'strong' || m.met === true) && m.severity === 'must_have')
    .slice(0, 3)
    .map(m => `• ${m.requirement}: ${m.cv_match || m.note || ''}`)
    .join('\n');

  const bestStory = (evaluationJson?.block_f?.star_stories || [])[0];
  const starStoryBlock = bestStory
    ? `Key achievement to feature:
Situation: ${bestStory.situation || ''}
Action: ${bestStory.action || ''}
Result: ${bestStory.result || ''}`
    : '';

  const cvSnippet = cvContent.slice(0, 3000);

  const prompt = `You are an expert career writer. Compose a compelling, personalized cover letter for this job application.

## Target Position
Role: ${role_}
Company: ${company_}
${jobUrl ? `Job listing: ${jobUrl}` : ''}
${tldr ? `What the role needs: ${tldr}` : ''}
${recommendationReason ? `Candidate fit: ${recommendationReason}` : ''}

## Candidate CV (excerpt)
${cvSnippet}

## Top Matching Strengths
${strongMatches || '(use CV to identify strongest matches)'}

## ${starStoryBlock || ''}

## Instructions
Write a 3-paragraph cover letter (220–280 words) that is paste-ready:

**Paragraph 1 — Hook & Intent** (3–4 sentences)
- Open with a compelling, specific first sentence — NOT "I am writing to apply for…"
- Express genuine enthusiasm for THIS role at THIS company (reference the domain or something specific about the role)
- State what you bring at a high level

**Paragraph 2 — Evidence & Value** (4–5 sentences)
- Lead with 1–2 concrete achievements with numbers/outcomes from the CV
- Tie them directly to the role's key requirements
- Incorporate the STAR story result if available (concisely)
- Show how your background maps to what they need

**Paragraph 3 — Conviction & CTA** (2–3 sentences)
- Express strong conviction you will add value in this specific role
- Brief cultural/mission alignment if apparent from context
- Clear, confident call to action

**Format rules:**
- Start with "Dear Hiring Manager,"
- End with "Sincerely," on its own line, then the candidate's name on the next line${candidateName ? ` (use: ${candidateName})` : ''}
- First person throughout, warm and confident — NOT arrogant or sycophantic
- Do NOT use hollow filler phrases ("I am excited to...", "I believe I would be a great fit...")
- Write as though the candidate wrote it themselves, not like a template

Return ONLY the complete cover letter. No commentary.`;

  const message = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0]?.text?.trim() || '';
}
