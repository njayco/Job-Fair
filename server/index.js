import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import healthRouter from './routes/health.js';
import evaluateRouter from './routes/evaluate.js';
import pdfRouter from './routes/pdf.js';
import applicationsRouter from './routes/applications.js';
import cvRouter from './routes/cv.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5000',
    'http://0.0.0.0:5000',
    /\.replit\.dev$/,
    /\.repl\.co$/,
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.use('/api', healthRouter);
app.use('/api/evaluate', evaluateRouter);
app.use('/api/generate-pdf', pdfRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/cv', cvRouter);

// 404 handler for API routes
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

app.listen(PORT, 'localhost', () => {
  console.log(`Career-Ops API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

export default app;
