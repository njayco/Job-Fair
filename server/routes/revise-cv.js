import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  ...(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY
    ? { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL }
    : {}),
});

const SYSTEM_PROMPT = [
  'You are an expert resume editor.',
  'You receive a candidate\'s original CV in markdown and a list of proposed changes from a job-specific evaluation.',
  'Your task: produce a single revised CV in clean markdown that applies the proposed changes faithfully while preserving every section, accomplishment, and detail in the original CV that is not being changed.',
  '',
  'Rules:',
  '- Preserve the original CV\'s structure, headings, ordering, dates, employers, and overall length.',
  '- Apply each proposed change to the section it targets. If a section in "current" is described in summary form, locate and rewrite the matching content in the original CV.',
  '- Never invent experience, metrics, employers, dates, or skills the candidate does not already have.',
  '- Keep the writing concise, professional, and ATS-friendly.',
  '- Output ONLY the final revised CV as markdown. No preamble, no commentary, no code fences.',
].join('\n');

router.post('/', async (req, res) => {
  try {
    const { cv_content, cv_changes, company, role } = req.body;

    if (!cv_content || typeof cv_content !== 'string' || cv_content.trim().length < 20) {
      return res.status(400).json({
        error: 'Original CV content is required to generate a revised resume.',
      });
    }

    if (!Array.isArray(cv_changes) || cv_changes.length === 0) {
      return res.status(400).json({
        error: 'No CV change suggestions were provided. Run an evaluation first.',
      });
    }

    const changesText = cv_changes
      .map((c, i) => {
        const section = c.section || `Change ${i + 1}`;
        const current = c.current || '(not specified)';
        const proposed = c.proposed || '(not specified)';
        const reason = c.reason || '';
        return `### Change ${i + 1} — ${section}\n- Current: ${current}\n- Proposed: ${proposed}${reason ? `\n- Reason: ${reason}` : ''}`;
      })
      .join('\n\n');

    const userPrompt = `Apply the following proposed changes to the CV below and return the complete revised CV in markdown.

Target role: ${role || 'N/A'} at ${company || 'N/A'}

## Original CV
${cv_content}

## Proposed Changes
${changesText}

Return only the revised CV markdown.`;

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let revised = message.content[0]?.text || '';

    // Strip wrapping code fences if the model included them anyway
    const fenced = revised.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```\s*$/);
    if (fenced) revised = fenced[1];

    revised = revised.trim();

    if (!revised) {
      return res.status(500).json({ error: 'The AI returned an empty revised CV. Please try again.' });
    }

    res.json({ revised_cv: revised });
  } catch (err) {
    console.error('POST /api/revise-cv error:', err);
    res.status(500).json({
      error: 'Failed to revise CV. Please try again.',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
});

export default router;
