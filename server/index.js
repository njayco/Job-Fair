import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { bootstrapSchema } from './db.js';
import { requireAuth } from './lib/authMiddleware.js';
import { WebhookHandlers } from './webhookHandlers.js';

import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import evaluateRouter from './routes/evaluate.js';
import pdfRouter from './routes/pdf.js';
import applicationsRouter from './routes/applications.js';
import cvRouter from './routes/cv.js';
import billingRouter from './routes/billing.js';
import publicBillingRouter from './routes/billing-public.js';

const app = express();
const PORT = process.env.API_PORT || 3001;
const HOST = '0.0.0.0';

app.use(cors({
  origin: true,
  credentials: true,
}));

// CRITICAL: Stripe webhook must be registered BEFORE express.json()
// It needs the raw Buffer body, not parsed JSON
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body, sig);
      res.status(200).json({ received: true });
    } catch (err) {
      console.error('Stripe webhook error:', err.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);

app.use('/api/evaluate', requireAuth, evaluateRouter);
app.use('/api/generate-pdf', requireAuth, pdfRouter);
app.use('/api/applications', requireAuth, applicationsRouter);
app.use('/api/cv', requireAuth, cvRouter);
// Public billing routes (no auth needed for pricing page)
app.use('/api/billing', publicBillingRouter);
// Protected billing routes
app.use('/api/billing', requireAuth, billingRouter);

app.use('/api/*path', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
  });
});

async function initStripe() {
  try {
    const { runMigrations } = await import('stripe-replit-sync');
    await runMigrations({ databaseUrl: process.env.DATABASE_URL, schema: 'stripe' });
    console.log('Stripe schema ready');

    const { getStripeSync } = await import('./stripeClient.js');
    const stripeSync = await getStripeSync();

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
    if (domain) {
      const webhookUrl = `https://${domain}/api/stripe/webhook`;
      await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      console.log('Stripe webhook configured');
    }

    stripeSync.syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err) => console.error('Stripe backfill error:', err.message));
  } catch (err) {
    console.error('Stripe init error (non-fatal):', err.message);
  }
}

bootstrapSchema()
  .then(async () => {
    await initStripe();
    app.listen(PORT, HOST, () => {
      console.log(`Career-Ops API running on http://${HOST}:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error('Failed to bootstrap schema:', err);
    process.exit(1);
  });

export default app;
