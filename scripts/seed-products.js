#!/usr/bin/env node
// Run: node scripts/seed-products.js
// Creates the Career-Ops Pro Plan product in Stripe (idempotent)

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function getStripeClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) throw new Error('Not running in Replit environment');

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', 'development');

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json', 'X-Replit-Token': xReplitToken },
  });

  const data = await response.json();
  const settings = data.items?.[0]?.settings;
  if (!settings?.secret) throw new Error('Stripe development connection not found');

  const Stripe = (await import('stripe')).default;
  return new Stripe(settings.secret, { apiVersion: '2025-08-27.basil' });
}

async function seedProducts() {
  const stripe = await getStripeClient();

  const existing = await stripe.products.search({
    query: "name:'Career-Ops Pro' AND active:'true'",
  });

  if (existing.data.length > 0) {
    console.log('Career-Ops Pro already exists:', existing.data[0].id);
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    console.log('Prices:');
    prices.data.forEach(p => {
      console.log(`  ${p.id}: $${p.unit_amount / 100}/${p.recurring?.interval}`);
    });
    return;
  }

  console.log('Creating Career-Ops Pro product...');
  const product = await stripe.products.create({
    name: 'Career-Ops Pro',
    description: 'Unlimited AI job evaluations + PDF generation. Cancel anytime.',
    metadata: { tier: 'pro' },
  });
  console.log('Created product:', product.id);

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1900,
    currency: 'usd',
    recurring: { interval: 'month' },
  });
  console.log(`Created price: $19.00/month (${price.id})`);
  console.log('\nDone! Run the API to sync via webhook.');
}

seedProducts().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
