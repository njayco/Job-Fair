/**
 * formInspector.js
 * Fetches a job application URL and attempts to detect form fields from the HTML.
 * Falls back to common ATS fields when the page is JS-rendered or inaccessible.
 */

import { validateAndResolveUrl } from './evaluation.js';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

// Common ATS fields used as a fallback when HTML inspection fails
const COMMON_ATS_FIELDS = [
  { label: 'First Name', name: 'first_name', type: 'text', required: true, selector: '', placeholder: '' },
  { label: 'Last Name', name: 'last_name', type: 'text', required: true, selector: '', placeholder: '' },
  { label: 'Email', name: 'email', type: 'email', required: true, selector: '', placeholder: '' },
  { label: 'Phone', name: 'phone', type: 'tel', required: false, selector: '', placeholder: '' },
  { label: 'LinkedIn Profile URL', name: 'linkedin_url', type: 'url', required: false, selector: '', placeholder: 'https://linkedin.com/in/...' },
  { label: 'Website / Portfolio', name: 'website', type: 'url', required: false, selector: '', placeholder: '' },
  { label: 'Location (City, Country)', name: 'location', type: 'text', required: false, selector: '', placeholder: '' },
  { label: 'Cover Letter', name: 'cover_letter', type: 'textarea', required: false, selector: '', placeholder: '' },
  { label: 'Why do you want to work here?', name: 'why_company', type: 'textarea', required: false, selector: '', placeholder: '' },
  { label: 'Work Authorization', name: 'work_authorization', type: 'select', required: false, selector: '', placeholder: '' },
  { label: 'Salary Expectation', name: 'salary_expectation', type: 'text', required: false, selector: '', placeholder: '' },
];

// Strip tags and clean whitespace from HTML content
function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Try to infer a human-readable label from a name/id attribute
function inferLabel(nameOrId) {
  if (!nameOrId) return '';
  return nameOrId
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

// Parse form fields from raw HTML
function parseFormFields(html) {
  const fields = [];
  const seen = new Set();

  // Remove scripts, styles, comments to reduce noise
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Build a label map: id → label text
  const labels = {};
  const labelRx = /<label[^>]*?(?:\bfor=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/label>/gi;
  let m;
  while ((m = labelRx.exec(clean)) !== null) {
    const forAttr = (m[1] || '').trim();
    const text = stripTags(m[2]).replace(/[*✱]+\s*$/, '').trim();
    if (text && forAttr) labels[forAttr] = text;
    // also map by normalised forAttr without prefix numbers
    const key = forAttr.replace(/^[^_]+_/, '');
    if (text && key) labels[key] = labels[key] || text;
  }

  // Skip these input types
  const SKIP_TYPES = new Set(['submit', 'button', 'hidden', 'reset', 'image', 'file', 'search']);

  // Extract <input> elements
  const inputRx = /<input([^>]*?)(?:\/>|>)/gi;
  while ((m = inputRx.exec(clean)) !== null) {
    const attrs = m[1];
    const id = (attrs.match(/\bid=["']([^"']*)["']/) || [])[1] || '';
    const name = (attrs.match(/\bname=["']([^"']*)["']/) || [])[1] || '';
    const type = ((attrs.match(/\btype=["']([^"']*)["']/) || [])[1] || 'text').toLowerCase();
    const placeholder = (attrs.match(/\bplaceholder=["']([^"']*)["']/) || [])[1] || '';
    const required = /\brequired\b/.test(attrs);

    if (SKIP_TYPES.has(type)) continue;

    const labelText = labels[id] || labels[name] || inferLabel(name) || inferLabel(id) || placeholder;
    if (!labelText) continue;

    const key = `${type}:${name || id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    fields.push({
      label: labelText,
      name: name || id,
      type: type === 'number' ? 'text' : type,
      required,
      selector: id ? `#${id}` : name ? `[name="${name}"]` : '',
      placeholder,
    });
  }

  // Extract <textarea> elements
  const textareaRx = /<textarea([^>]*)>[\s\S]*?<\/textarea>/gi;
  while ((m = textareaRx.exec(clean)) !== null) {
    const attrs = m[1];
    const id = (attrs.match(/\bid=["']([^"']*)["']/) || [])[1] || '';
    const name = (attrs.match(/\bname=["']([^"']*)["']/) || [])[1] || '';
    const placeholder = (attrs.match(/\bplaceholder=["']([^"']*)["']/) || [])[1] || '';
    const required = /\brequired\b/.test(attrs);

    const labelText = labels[id] || labels[name] || inferLabel(name) || inferLabel(id) || placeholder;
    if (!labelText) continue;

    const key = `textarea:${name || id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    fields.push({
      label: labelText,
      name: name || id,
      type: 'textarea',
      required,
      selector: id ? `#${id}` : name ? `[name="${name}"]` : '',
      placeholder,
    });
  }

  // Extract <select> elements
  const selectRx = /<select([^>]*)>[\s\S]*?<\/select>/gi;
  while ((m = selectRx.exec(clean)) !== null) {
    const attrs = m[1];
    const id = (attrs.match(/\bid=["']([^"']*)["']/) || [])[1] || '';
    const name = (attrs.match(/\bname=["']([^"']*)["']/) || [])[1] || '';
    const required = /\brequired\b/.test(attrs);

    const labelText = labels[id] || labels[name] || inferLabel(name) || inferLabel(id);
    if (!labelText) continue;

    const key = `select:${name || id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    fields.push({
      label: labelText,
      name: name || id,
      type: 'select',
      required,
      selector: id ? `#${id}` : name ? `[name="${name}"]` : '',
      placeholder: '',
    });
  }

  return fields;
}

// Fetch with manual redirect following + SSRF validation on every hop
async function safeFetch(url, maxRedirects = 5) {
  let currentUrl = url;
  let redirectsLeft = maxRedirects;

  while (true) {
    const res = await fetch(currentUrl, {
      headers: BROWSER_HEADERS,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });

    const status = res.status;

    // Check for redirect responses
    if ([301, 302, 303, 307, 308].includes(status)) {
      if (redirectsLeft <= 0) {
        throw new Error('Too many redirects');
      }
      const location = res.headers.get('location');
      if (!location) throw new Error('Redirect missing Location header');

      // Resolve relative redirects against the current URL
      const nextUrl = new URL(location, currentUrl).href;

      // SSRF validation on the redirect target
      await validateAndResolveUrl(nextUrl);

      currentUrl = nextUrl;
      redirectsLeft--;
      continue;
    }

    return res;
  }
}

export async function inspectForm(url) {
  let html = '';
  let fetchError = null;
  let detectionType = 'detected';

  try {
    const res = await safeFetch(url);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'AUTH_WALL' };
      }
      fetchError = `HTTP ${res.status}`;
    } else {
      html = await res.text();
    }
  } catch (err) {
    fetchError = err.message;
    const msg = err.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('aborted')) {
      return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'TIMEOUT' };
    }
    // SSRF or URL validation error — surface clearly
    if (msg.includes('private') || msg.includes('reserved') || msg.includes('invalid url') || msg.includes('only http')) {
      throw err;
    }
  }

  if (fetchError) {
    return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'FETCH_ERROR' };
  }

  // Check for common signs the form needs JS to render
  const lowerHtml = html.toLowerCase();
  const hasReactRoot = lowerHtml.includes('id="root"') || lowerHtml.includes('id="app"') || lowerHtml.includes('__next');
  const hasFormTag = /<form[\s>]/i.test(html);
  const hasInputs = /<input/i.test(html);

  if (!hasFormTag && !hasInputs) {
    // JS-rendered — try to use the page text for context but fall back to common fields
    return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: hasReactRoot ? 'JS_REQUIRED' : 'NO_FORM' };
  }

  const detectedFields = parseFormFields(html);

  // If we found meaningful fields (>2), use them; otherwise fall back
  const meaningfulFields = detectedFields.filter(f =>
    f.type !== 'hidden' && (f.label || f.name)
  );

  if (meaningfulFields.length < 3) {
    // Merge detected into common fields where possible
    return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: null };
  }

  detectionType = 'detected';
  return { fields: meaningfulFields, detectionType, error: null };
}
