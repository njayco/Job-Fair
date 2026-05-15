#!/usr/bin/env node
// Validates server/data/companies.js — exits non-zero if any integrity check fails.
// Usage: node server/scripts/validate-companies.js

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const { DEFAULT_COMPANIES } = await import(join(__dir, '../data/companies.js'));

const VALID_API_TYPES = new Set(['greenhouse', 'greenhouse_eu', 'ashby', 'lever']);
const VALID_INDUSTRIES = new Set([
  'Technology', 'Fintech', 'Healthcare & Life Sciences', 'Finance & Banking',
  'Retail & E-Commerce', 'Media & Entertainment', 'Education & EdTech',
  'Logistics & Supply Chain', 'HR Tech', 'Real Estate & PropTech',
  'Consumer Goods', 'Marketing Tech', 'Manufacturing & Industrials',
  'Gaming & Metaverse', 'Insurance', 'Government Contractors',
  'Hospitality & Travel', 'Food & Beverage', 'Legal & Professional Services',
  'Energy & Climate Tech', 'AgriTech', 'Construction & PropTech', 'Non-Profit & NGO',
]);

const errors = [];
const seen = new Set();

for (let i = 0; i < DEFAULT_COMPANIES.length; i++) {
  const c = DEFAULT_COMPANIES[i];
  const ctx = `[${i}] slug="${c.api_slug}"`;

  if (!c.name || typeof c.name !== 'string' || c.name.trim().length === 0)
    errors.push(`${ctx}: missing or empty name`);

  if (!VALID_API_TYPES.has(c.api_type))
    errors.push(`${ctx}: invalid api_type "${c.api_type}"`);

  if (!c.api_slug || typeof c.api_slug !== 'string' || c.api_slug.trim().length < 2)
    errors.push(`${ctx}: invalid api_slug`);

  if (c.api_slug && !/^[a-zA-Z0-9._-]+$/.test(c.api_slug))
    errors.push(`${ctx}: api_slug contains invalid characters (use a-z, 0-9, . - _)`);

  if (!VALID_INDUSTRIES.has(c.industry))
    errors.push(`${ctx}: invalid industry "${c.industry}"`);

  if (c.name && !/[\s./-]/.test(c.name) && c.name.length > 25 && c.name === c.name.toLowerCase())
    errors.push(`${ctx}: name looks like a raw slug — "${c.name}"`);

  const dupKey = `${c.api_type}:${c.api_slug.toLowerCase()}`;
  if (seen.has(dupKey))
    errors.push(`${ctx}: duplicate (api_type, api_slug) pair`);
  seen.add(dupKey);
}

const byIndustry = {};
DEFAULT_COMPANIES.forEach(c => byIndustry[c.industry] = (byIndustry[c.industry] || 0) + 1);

console.log(`\nCompany dataset validation`);
console.log(`  Total entries : ${DEFAULT_COMPANIES.length}`);
console.log(`  Industries    : ${Object.keys(byIndustry).length}`);
console.log(`  ATS types     : ${[...new Set(DEFAULT_COMPANIES.map(c => c.api_type))].join(', ')}`);

if (errors.length > 0) {
  console.error(`\n  FAILED — ${errors.length} error(s):`);
  errors.slice(0, 20).forEach(e => console.error('  x', e));
  if (errors.length > 20) console.error(`  ... and ${errors.length - 20} more`);
  process.exit(1);
}

console.log(`\n  PASSED — all ${DEFAULT_COMPANIES.length} entries are valid.\n`);
