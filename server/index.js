import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { bootstrapSchema } from './db.js';
import { requireAuth } from './lib/authMiddleware.js';

import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import evaluateRouter from './routes/evaluate.js';
import pdfRouter from './routes/pdf.js';
import applicationsRouter from './routes/applications.js';
import cvRouter from './routes/cv.js';

const app = express();
const PORT = process.env.API_PORT || 3001;
const HOST = '0.0.0.0';

app.use(cors({
  origin: true,
  credentials: true,
}));

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

app.use('/api/*path', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// Serve the built React app for all non-API routes (client-side routing)
const clientDist = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.use((req, res) => {
  res.sendFile(join(clientDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
  });
});

bootstrapSchema()
  .then(() => {
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
