/**
 * applyDrafter.js
 * Uses Claude to draft answers for job application form fields
 * based on the user's CV and evaluation data.
 */

import { anthropicClient, MODEL } from './evaluation.js';

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

  // Pull key context from evaluation blocks
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

  // Parse Claude's response
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\[[\s\S]*\])/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  let answers = [];
  try {
    answers = JSON.parse(jsonStr.trim());
  } catch (e) {
    console.warn('[applyDrafter] Failed to parse Claude response:', e.message);
    answers = [];
  }

  // Build a lookup map from label → proposed_value
  const answerMap = {};
  for (const a of answers) {
    if (a.label) answerMap[a.label.toLowerCase()] = a.proposed_value || '';
  }

  // Enrich each field with its proposed value
  return fields.map(f => ({
    ...f,
    proposed_value: answerMap[f.label.toLowerCase()] ?? '',
    approved_value: answerMap[f.label.toLowerCase()] ?? '',
  }));
}
