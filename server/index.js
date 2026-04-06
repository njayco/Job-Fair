import express from 'express';
import cors from 'cors';
import { bootstrapSchema } from './db.js';

import healthRouter from './routes/health.js';
import evaluateRouter from './routes/evaluate.js';
import pdfRouter from './routes/pdf.js';
import applicationsRouter from './routes/applications.js';
import cvRouter from './routes/cv.js';

const app = express();
const PORT = process.env.API_PORT || 3001;
const HOST = '0.0.0.0';

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', healthRouter);
app.use('/api/evaluate', evaluateRouter);
app.use('/api/generate-pdf', pdfRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/cv', cvRouter);

// 404 handler
app.use('/api/*path', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
  });
});

// Bootstrap schema then start server
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
