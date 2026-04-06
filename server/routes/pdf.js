import { Router } from 'express';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
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

/**
 * Parse CV markdown text into a structured cv_data object.
 * This is a best-effort parser that extracts common sections.
 */
function parseCvMarkdown(markdown) {
  const lines = markdown.split('\n');
  const cv = {
    name: '',
    email: '',
    location: '',
    linkedin_url: '',
    linkedin_display: '',
    portfolio_url: '',
    portfolio_display: '',
    summary: '',
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    skills: [],
  };

  let currentSection = null;
  let currentJob = null;
  let i = 0;

  // Try to extract header fields from the first few non-empty lines
  let headerLines = 0;
  for (let j = 0; j < Math.min(10, lines.length) && headerLines < 6; j++) {
    const line = lines[j].trim();
    if (!line) continue;
    if (line.startsWith('#') && !cv.name) {
      cv.name = line.replace(/^#+\s*/, '').trim();
      headerLines++;
    } else if (!cv.email && /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(line)) {
      const emailMatch = line.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) cv.email = emailMatch[0];
      headerLines++;
    } else if (!cv.linkedin_url && /linkedin\.com/.test(line)) {
      const urlMatch = line.match(/https?:\/\/[^\s)]+/);
      cv.linkedin_url = urlMatch ? urlMatch[0] : line;
      cv.linkedin_display = cv.linkedin_url.replace(/https?:\/\//, '');
      headerLines++;
    } else if (!cv.portfolio_url && /http/.test(line) && !/linkedin/.test(line)) {
      const urlMatch = line.match(/https?:\/\/[^\s)]+/);
      cv.portfolio_url = urlMatch ? urlMatch[0] : '';
      cv.portfolio_display = cv.portfolio_url.replace(/https?:\/\//, '');
      headerLines++;
    }
  }

  const sectionPatterns = {
    summary: /^#+\s*(summary|profile|about|objective|professional summary)/i,
    experience: /^#+\s*(experience|work|employment|career|professional experience)/i,
    projects: /^#+\s*(projects|portfolio|side projects|open source)/i,
    education: /^#+\s*(education|academic|qualifications|degrees)/i,
    certifications: /^#+\s*(certifications?|credentials?|licenses?|certificates?)/i,
    skills: /^#+\s*(skills|technologies|technical skills|competencies|tools)/i,
  };

  for (i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for section headers
    let matchedSection = null;
    for (const [section, pattern] of Object.entries(sectionPatterns)) {
      if (pattern.test(trimmed)) {
        matchedSection = section;
        break;
      }
    }

    if (matchedSection) {
      if (currentJob && currentSection === 'experience') {
        cv.experience.push(currentJob);
        currentJob = null;
      }
      currentSection = matchedSection;
      continue;
    }

    if (!currentSection) continue;

    if (currentSection === 'summary') {
      if (!trimmed.startsWith('#')) {
        cv.summary += (cv.summary ? ' ' : '') + trimmed.replace(/^\*+|\*+$/g, '');
      }
    } else if (currentSection === 'experience') {
      // Job header: bold or heading line with company + role + period
      const jobHeader = trimmed.match(/^(#{2,3}|##|\*\*)\s*(.+?)(\*\*)?$/);
      if (trimmed.startsWith('##') || (trimmed.startsWith('**') && trimmed.endsWith('**'))) {
        if (currentJob) cv.experience.push(currentJob);
        const title = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
        // Try to split "Role @ Company | Period" or "Company — Role | Period"
        const parts = title.split(/\s*[@|—|–|-]\s*/);
        currentJob = {
          company: parts[1]?.trim() || title,
          role: parts[0]?.trim() || '',
          period: parts[2]?.trim() || '',
          location: '',
          bullets: [],
        };
      } else if (currentJob && (trimmed.startsWith('- ') || trimmed.startsWith('* '))) {
        currentJob.bullets.push(trimmed.replace(/^[-*]\s*/, ''));
      } else if (currentJob && trimmed && !trimmed.startsWith('#')) {
        // Might be a date or location line
        if (/\d{4}/.test(trimmed) && !currentJob.period) {
          currentJob.period = trimmed;
        }
      }
    } else if (currentSection === 'projects') {
      if (trimmed.startsWith('##') || (trimmed.startsWith('**') && trimmed.endsWith('**'))) {
        cv.projects.push({
          title: trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, ''),
          description: '',
          tech: '',
        });
      } else if (cv.projects.length > 0 && trimmed && !trimmed.startsWith('#')) {
        const lastProject = cv.projects[cv.projects.length - 1];
        if (!lastProject.description) {
          lastProject.description = trimmed;
        } else if (!lastProject.tech && (trimmed.toLowerCase().includes('tech:') || trimmed.startsWith('*'))) {
          lastProject.tech = trimmed.replace(/^.*tech:\s*/i, '').replace(/\*/g, '');
        }
      }
    } else if (currentSection === 'education') {
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
        const parts = trimmed.split(/\s*[|,]\s*/);
        cv.education.push({
          degree: parts[0] || trimmed,
          institution: parts[1] || '',
          year: parts[2] || '',
        });
      }
    } else if (currentSection === 'certifications') {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || (!trimmed.startsWith('#') && trimmed)) {
        const certText = trimmed.replace(/^[-*]\s*/, '');
        const parts = certText.split(/\s*[|,—]\s*/);
        cv.certifications.push({
          name: parts[0] || certText,
          issuer: parts[1] || '',
          year: parts[2] || '',
        });
      }
    } else if (currentSection === 'skills') {
      if (trimmed && !trimmed.startsWith('#')) {
        if (trimmed.includes(':')) {
          const colonIdx = trimmed.indexOf(':');
          cv.skills.push({
            category: trimmed.slice(0, colonIdx).replace(/[-*]/g, '').trim(),
            items: trimmed.slice(colonIdx + 1).trim(),
          });
        } else {
          const items = trimmed.replace(/^[-*]\s*/, '').split(/\s*[,|]\s*/);
          items.forEach(item => { if (item.trim()) cv.skills.push(item.trim()); });
        }
      }
    }
  }

  // Push last job
  if (currentJob && currentSection === 'experience') {
    cv.experience.push(currentJob);
  }

  return cv;
}

async function renderCV(cvData, evaluation) {
  let html = await readFile(templatePath, 'utf-8');

  const isUS = (evaluation?.block_a?.remote || '').toLowerCase().includes('us') ||
               (evaluation?.company || '').toLowerCase().includes('inc') ||
               (evaluation?.company || '').toLowerCase().includes('llc');
  const format = isUS ? 'letter' : 'a4';

  const keywords = evaluation?.keywords?.slice(0, 8) || [];
  const competencyTags = keywords
    .map(k => `<span class="competency-tag">${k}</span>`)
    .join('\n      ');

  const baseSummary = cvData.summary || 'Experienced professional with a proven track record.';
  const topKeywords = keywords.slice(0, 3).join(', ');
  const tailoredSummary = topKeywords
    ? `${baseSummary} Specialized expertise in ${topKeywords}.`
    : baseSummary;

  const replacements = {
    '{{LANG}}': 'en',
    '{{PAGE_WIDTH}}': format === 'letter' ? '8.5in' : '210mm',
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
// Body (option A — structured): { cv_data: {...}, evaluation?, application_id? }
// Body (option B — markdown):   { cv_markdown: "# Name\n...", evaluation?, application_id? }
// evaluation is optional but improves tailoring (adds keywords, adjusts summary)
router.post('/', async (req, res) => {
  let browser = null;

  try {
    const { cv_data, cv_markdown, evaluation, application_id, format: requestedFormat } = req.body;

    if (!cv_data && !cv_markdown) {
      return res.status(400).json({
        error: 'Either cv_data (structured object) or cv_markdown (markdown string) is required.',
      });
    }

    // Resolve the CV data: structured object takes priority; markdown is parsed
    const resolvedCvData = cv_data || parseCvMarkdown(cv_markdown);

    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }

    const { html, format } = await renderCV(resolvedCvData, evaluation);

    const company = slugify(evaluation?.company || resolvedCvData?.name || 'cv');
    const date = new Date().toISOString().split('T')[0];
    const tmpFileName = `cv-${company}-${date}-${Date.now()}.html`;
    const tmpHtmlPath = resolve(tmpDir, tmpFileName);
    await writeFile(tmpHtmlPath, html, 'utf-8');

    // Lazy-import Playwright so server starts even if Chromium isn't installed yet
    const { chromium } = await import('playwright');

    browser = await chromium.launch({ headless: true });
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
    browser = null;

    const pdfString = pdfBuffer.toString('latin1');
    const pageCount = (pdfString.match(/\/Type\s*\/Page[^s]/g) || []).length;

    if (application_id) {
      await pool.query(
        'UPDATE applications SET updated_at = NOW() WHERE id = $1',
        [parseInt(application_id, 10)]
      ).catch(() => {});
    }

    const filename = `cv-${company}-${date}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
      'X-Page-Count': pageCount,
      'X-File-Size': pdfBuffer.length,
    });

    res.send(pdfBuffer);

    // Cleanup temp file asynchronously
    unlink(tmpHtmlPath).catch(() => {});
  } catch (err) {
    console.error('POST /api/generate-pdf error:', err);
    if (browser) browser.close().catch(() => {});
    res.status(500).json({
      error: 'PDF generation failed',
      details: err.message,
    });
  }
});

export default router;
