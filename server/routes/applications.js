import { Router } from 'express';
import pool from '../db.js';

const router = Router();

const VALID_STATUSES = [
  'Evaluated', 'Applied', 'Responded', 'Interview',
  'Offer', 'Rejected', 'Discarded', 'SKIP',
];

// GET /api/applications — list all applications
router.get('/', async (req, res) => {
  try {
    const { status, sort = 'created_at', order = 'desc', limit = 100, offset = 0 } = req.query;

    const validSorts = ['created_at', 'score', 'company', 'role', 'status'];
    const validOrders = ['asc', 'desc'];
    const sortCol = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = validOrders.includes(order) ? order : 'desc';

    let query = `
      SELECT id, company, role, score, status, url, archetype, tldr, remote,
             comp_score, keywords, created_at, updated_at,
             LEFT(report_md, 500) as report_preview
      FROM applications
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` WHERE status = $${params.length}`;
    }

    query += ` ORDER BY ${sortCol} ${sortOrder}`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    const countQuery = status
      ? `SELECT COUNT(*) FROM applications WHERE status = $1`
      : `SELECT COUNT(*) FROM applications`;
    const countResult = await pool.query(countQuery, status ? [status] : []);

    res.json({
      applications: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('GET /api/applications error:', err);
    res.status(500).json({ error: 'Failed to fetch applications', details: err.message });
  }
});

// GET /api/applications/:id — get single application
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM applications WHERE id = $1',
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/applications/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch application', details: err.message });
  }
});

// GET /api/applications/:id/report — get full report markdown
router.get('/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT report_md, company, role FROM applications WHERE id = $1',
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { report_md, company, role } = result.rows[0];

    if (!report_md) {
      return res.status(404).json({ error: 'No report available for this application' });
    }

    res.json({ report_md, company, role });
  } catch (err) {
    console.error('GET /api/applications/:id/report error:', err);
    res.status(500).json({ error: 'Failed to fetch report', details: err.message });
  }
});

// POST /api/applications — create a new application
router.post('/', async (req, res) => {
  try {
    const { company, role, score, status, url, report_md, archetype, tldr, remote, comp_score, keywords } = req.body;

    if (!company || !role) {
      return res.status(400).json({ error: 'company and role are required' });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const result = await pool.query(
      `INSERT INTO applications (company, role, score, status, url, report_md, archetype, tldr, remote, comp_score, keywords)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        company, role,
        score !== undefined ? parseFloat(score) : null,
        status || 'Evaluated',
        url || null,
        report_md || null,
        archetype || null,
        tldr || null,
        remote || null,
        comp_score !== undefined ? parseFloat(comp_score) : null,
        keywords ? (Array.isArray(keywords) ? keywords : [keywords]) : null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/applications error:', err);
    res.status(500).json({ error: 'Failed to create application', details: err.message });
  }
});

// PATCH /api/applications/:id — update application (status, notes, etc.)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { company, role, score, status, url, report_md, archetype, tldr, remote, comp_score, keywords } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Check application exists
    const existing = await pool.query('SELECT id FROM applications WHERE id = $1', [parseInt(id)]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = { company, role, score, status, url, report_md, archetype, tldr, remote, comp_score, keywords };
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${key} = $${paramCount++}`);
        if (key === 'score' || key === 'comp_score') {
          values.push(val !== null ? parseFloat(val) : null);
        } else if (key === 'keywords' && val !== null) {
          values.push(Array.isArray(val) ? val : [val]);
        } else {
          values.push(val);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(parseInt(id));
    const result = await pool.query(
      `UPDATE applications SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/applications/:id error:', err);
    res.status(500).json({ error: 'Failed to update application', details: err.message });
  }
});

// DELETE /api/applications/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM applications WHERE id = $1 RETURNING id',
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ deleted: true, id: parseInt(id) });
  } catch (err) {
    console.error('DELETE /api/applications/:id error:', err);
    res.status(500).json({ error: 'Failed to delete application', details: err.message });
  }
});

export default router;
