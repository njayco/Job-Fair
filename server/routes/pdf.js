import { Router } from 'express';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import pool from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');
const templatePath = resolve(projectRoot, 'templates', 'cv-template.html');
const fontsDir = resolve(projectRoot, 'fonts');
const tmpDir = resolve(projectRoot, 'output');

const router = Router();

function slugify(str) {
  return (str || 'company')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function renderCV(cvData, evaluation) {
  // Read the HTML template
  let html = await readFile(templatePath, 'utf-8');

  // Detect format from remote field or default to a4
  const isUS = (evaluation?.block_a?.remote || '').toLowerCase().includes('us') ||
               (evaluation?.company || '').toLowerCase().includes('inc') ||
               (evaluation?.company || '').toLowerCase().includes('llc');
  const format = isUS ? 'letter' : 'a4';
  const pageWidth = format === 'letter' ? '8.5in' : '210mm';

  // Detect language from job (default English)
  const lang = 'en';

  // Build competency tags from keywords
  const keywords = evaluation?.keywords?.slice(0, 8) || [];
  const competencyTags = keywords
    .map(k => `<span class="competency-tag">${k}</span>`)
    .join('\n      ');

  // Build a tailored summary by injecting top keywords into the existing summary
  const baseSummary = cvData.summary || 'Experienced professional with a proven track record.';
  const topKeywords = keywords.slice(0, 3).join(', ');
  const tailoredSummary = topKeywords
    ? `${baseSummary} Specialized expertise in ${topKeywords}.`
    : baseSummary;

  // Replace all template placeholders
  const replacements = {
    '{{LANG}}': lang,
    '{{PAGE_WIDTH}}': pageWidth,
    '{{NAME}}': cvData.name || 'Your Name',
    '{{EMAIL}}': cvData.email || 'email@example.com',
    '{{LINKEDIN_URL}}': cvData.linkedin_url || '#',
    '{{LINKEDIN_DISPLAY}}': cvData.linkedin_display || 'linkedin.com/in/yourprofile',
    '{{PORTFOLIO_URL}}': cvData.portfolio_url || '#',
    '{{PORTFOLIO_DISPLAY}}': cvData.portfolio_display || 'yourwebsite.com',
    '{{LOCATION}}': cvData.location || '',
    '{{SECTION_SUMMARY}}': 'Professional Summary',
    '{{SUMMARY_TEXT}}': tailoredSummary,
    '{{SECTION_COMPETENCIES}}': 'Core Competencies',
    '{{COMPETENCIES}}': competencyTags || '<span class="competency-tag">AI/ML Engineering</span>',
    '{{SECTION_EXPERIENCE}}': 'Work Experience',
    '{{EXPERIENCE}}': cvData.experience_html || generateExperienceHTML(cvData.experience || []),
    '{{SECTION_PROJECTS}}': 'Projects',
    '{{PROJECTS}}': cvData.projects_html || generateProjectsHTML(cvData.projects || []),
    '{{SECTION_EDUCATION}}': 'Education',
    '{{EDUCATION}}': cvData.education_html || generateEducationHTML(cvData.education || []),
    '{{SECTION_CERTIFICATIONS}}': 'Certifications',
    '{{CERTIFICATIONS}}': cvData.certifications_html || generateCertificationsHTML(cvData.certifications || []),
    '{{SECTION_SKILLS}}': 'Skills',
    '{{SKILLS}}': cvData.skills_html || generateSkillsHTML(cvData.skills || []),
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    html = html.replaceAll(placeholder, value);
  }

  // Fix font paths to use absolute file:// URLs
  html = html.replace(/url\(['"]?\.\/fonts\//g, `url('file://${fontsDir}/`);
  html = html.replace(/file:\/\/([^'")]+)\.woff2['"]\)/g, `file://$1.woff2')`);

  return { html, format };
}

function generateExperienceHTML(experiences) {
  if (!experiences || experiences.length === 0) {
    return '<p style="color:#888;font-style:italic;">Add your work experience to your CV.</p>';
  }
  return experiences.map(exp => `
    <div class="job avoid-break">
      <div class="job-header">
        <span class="job-company">${exp.company || ''}</span>
        <span class="job-period">${exp.period || ''}</span>
      </div>
      <div class="job-role">${exp.role || ''}</div>
      ${exp.location ? `<div class="job-location">${exp.location}</div>` : ''}
      <ul>${(exp.bullets || []).map(b => `<li>${b}</li>`).join('')}</ul>
    </div>
  `).join('');
}

function generateProjectsHTML(projects) {
  if (!projects || projects.length === 0) return '';
  return projects.map(p => `
    <div class="project avoid-break">
      <span class="project-title">${p.title || ''}</span>
      ${p.badge ? `<span class="project-badge">${p.badge}</span>` : ''}
      <div class="project-desc">${p.description || ''}</div>
      ${p.tech ? `<div class="project-tech">${p.tech}</div>` : ''}
    </div>
  `).join('');
}

function generateEducationHTML(education) {
  if (!education || education.length === 0) return '';
  return education.map(e => `
    <div class="edu-item">
      <div class="edu-header">
        <span class="edu-title">${e.degree || ''} <span class="edu-org">${e.institution || ''}</span></span>
        <span class="edu-year">${e.year || ''}</span>
      </div>
      ${e.description ? `<div class="edu-desc">${e.description}</div>` : ''}
    </div>
  `).join('');
}

function generateCertificationsHTML(certs) {
  if (!certs || certs.length === 0) return '';
  return certs.map(c => `
    <div class="cert-item">
      <span class="cert-title">${c.name || ''} <span class="cert-org">${c.issuer || ''}</span></span>
      <span class="cert-year">${c.year || ''}</span>
    </div>
  `).join('');
}

function generateSkillsHTML(skills) {
  if (!skills || skills.length === 0) return '';
  return `<div class="skills-grid">${skills.map(s => {
    if (typeof s === 'string') return `<span class="skill-item">${s}</span>`;
    return `<span class="skill-item"><span class="skill-category">${s.category}:</span> ${s.items || ''}</span>`;
  }).join('')}</div>`;
}

// POST /api/generate-pdf
// Body: { cv_data (structured or markdown), evaluation (from /api/evaluate), application_id? }
router.post('/', async (req, res) => {
  let tmpHtmlPath = null;

  try {
    const { cv_data, evaluation, application_id, format: requestedFormat } = req.body;

    if (!cv_data) {
      return res.status(400).json({ error: 'cv_data is required' });
    }

    // Ensure output directory exists
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }

    // Render the HTML
    const { html, format } = await renderCV(cv_data, evaluation);

    // Write temp HTML file
    const company = slugify(evaluation?.company || cv_data?.name || 'cv');
    const date = new Date().toISOString().split('T')[0];
    const tmpFileName = `cv-${company}-${date}-${Date.now()}.html`;
    tmpHtmlPath = resolve(tmpDir, tmpFileName);
    await writeFile(tmpHtmlPath, html, 'utf-8');

    // Generate PDF with Playwright
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle',
      baseURL: `file://${tmpDir}/`,
    });

    await page.evaluate(() => document.fonts.ready);

    const pdfBuffer = await page.pdf({
      format: requestedFormat || format,
      printBackground: true,
      margin: { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' },
      preferCSSPageSize: false,
    });

    await browser.close();

    // Count pages
    const pdfString = pdfBuffer.toString('latin1');
    const pageCount = (pdfString.match(/\/Type\s*\/Page[^s]/g) || []).length;

    // Update application if ID provided
    if (application_id) {
      await pool.query(
        'UPDATE applications SET updated_at = NOW() WHERE id = $1',
        [parseInt(application_id)]
      ).catch(() => {});
    }

    // Stream PDF back
    const filename = `cv-${company}-${date}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
      'X-Page-Count': pageCount,
      'X-File-Size': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error('POST /api/generate-pdf error:', err);
    res.status(500).json({
      error: 'PDF generation failed',
      details: err.message,
    });
  } finally {
    // Clean up temp HTML file
    if (tmpHtmlPath && existsSync(tmpHtmlPath)) {
      unlink(tmpHtmlPath).catch(() => {});
    }
  }
});

export default router;
