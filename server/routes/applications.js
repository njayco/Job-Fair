import { Router } from 'express';
import pool from '../db.js';

const router = Router();

const VALID_STATUSES = [
  'Evaluated', 'Applied', 'Responded', 'Interview',
  'Offer', 'Rejected', 'Discarded', 'SKIP',
];
const VALID_SORT_COLS = ['created_at', 'updated_at', 'score', 'comp_score', 'company', 'role', 'status'];

// GET /api/applications
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      sort = 'created_at',
      order = 'desc',
      status,
      limit = 100,
      offset = 0,
    } = req.query;

    const sortCol = VALID_SORT_COLS.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const filterParams = [userId];
    let whereClause = 'WHERE user_id = $1';
    if (status && VALID_STATUSES.includes(status)) {
      filterParams.push(status);
      whereClause += ` AND status = $${filterParams.length}`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM applications ${whereClause}`,
      filterParams
    );

    const paginatedParams = [...filterParams, parseInt(limit, 10) || 100, parseInt(offset, 10) || 0];
    const query = `
      SELECT id, company, role, score, status, url,
             archetype, tldr, remote, comp_score, keywords,
             created_at, updated_at,
             LEFT(report_md, 500) AS report_preview
      FROM applications
      ${whereClause}
      ORDER BY ${sortCol} ${sortOrder} NULLS LAST
      LIMIT $${paginatedParams.length - 1}
      OFFSET $${paginatedParams.length}
    `;

    const result = await pool.query(query, paginatedParams);

    res.json({
      applications: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit: parseInt(limit, 10) || 100,
      offset: parseInt(offset, 10) || 0,
    });
  } catch (err) {
    console.error('GET /api/applications error:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET /api/applications/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM applications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/applications/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// GET /api/applications/:id/report
router.get('/:id/report', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, company, role, report_md FROM applications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = result.rows[0];
    if (!app.report_md) {
      return res.status(404).json({ error: 'No report available for this application' });
    }

    res.json({ id: app.id, company: app.company, role: app.role, report_md: app.report_md });
  } catch (err) {
    console.error('GET /api/applications/:id/report error:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// POST /api/applications
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      company, role, score, status = 'Evaluated',
      url, report_md, archetype, tldr, remote, comp_score, keywords,
    } = req.body;

    if (!company || !role) {
      return res.status(400).json({ error: 'company and role are required' });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}` });
    }

    const result = await pool.query(
      `INSERT INTO applications
         (user_id, company, role, score, status, url, report_md,
          archetype, tldr, remote, comp_score, keywords)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        userId, company, role,
        score !== undefined ? parseFloat(score) : null,
        status,
        url || null,
        report_md || null,
        archetype || null,
        tldr || null,
        remote || null,
        comp_score !== undefined ? parseFloat(comp_score) : null,
        keywords && keywords.length > 0 ? keywords : null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/applications error:', err);
    res.status(500).json({ error: 'Failed to create application' });
  }
});

// PATCH /api/applications/:id
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, score, archetype, remote, comp_score, keywords, url, tldr } = req.body;

    const existing = await pool.query(
      'SELECT id FROM applications WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}` });
    }

    const updates = [];
    const params = [];

    if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
    if (score !== undefined) { params.push(parseFloat(score)); updates.push(`score = $${params.length}`); }
    if (archetype !== undefined) { params.push(archetype); updates.push(`archetype = $${params.length}`); }
    if (remote !== undefined) { params.push(remote); updates.push(`remote = $${params.length}`); }
    if (comp_score !== undefined) { params.push(parseFloat(comp_score)); updates.push(`comp_score = $${params.length}`); }
    if (keywords !== undefined) { params.push(keywords); updates.push(`keywords = $${params.length}`); }
    if (url !== undefined) { params.push(url); updates.push(`url = $${params.length}`); }
    if (tldr !== undefined) { params.push(tldr); updates.push(`tldr = $${params.length}`); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(req.params.id, userId);
    const query = `
      UPDATE applications
      SET ${updates.join(', ')}
      WHERE id = $${params.length - 1} AND user_id = $${params.length}
      RETURNING *
    `;

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/applications/:id error:', err);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// DELETE /api/applications/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM applications WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ deleted: true, id: parseInt(req.params.id, 10) });
  } catch (err) {
    console.error('DELETE /api/applications/:id error:', err);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

export default router;
