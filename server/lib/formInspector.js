/**
 * formInspector.js
 * Fetches a job application URL and attempts to detect form fields from the HTML.
 * Falls back to common ATS fields when the page is JS-rendered or inaccessible.
 *
 * Security: uses safeFetch() which validates every redirect hop via validateAndResolveUrl
 * to prevent SSRF attacks, and enforces content-type + response-size limits.
 */

import { validateAndResolveUrl } from './evaluation.js';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity', // avoid compressed streams for size enforcement
  'Cache-Control': 'no-cache',
};

// Max HTML response size to parse (2 MB). Larger responses are likely binary or CDN errors.
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

// Common ATS fields used as a fallback when HTML inspection fails or yields too few results.
// Includes a resume upload sentinel so users are explicitly reminded to attach their CV.
const COMMON_ATS_FIELDS = [
  { label: 'First Name', name: 'first_name', type: 'text', required: true, selector: '', placeholder: '' },
  { label: 'Last Name', name: 'last_name', type: 'text', required: true, selector: '', placeholder: '' },
  { label: 'Email', name: 'email', type: 'email', required: true, selector: '', placeholder: '' },
  { label: 'Phone', name: 'phone', type: 'tel', required: false, selector: '', placeholder: '' },
  { label: 'LinkedIn Profile URL', name: 'linkedin_url', type: 'url', required: false, selector: '', placeholder: 'https://linkedin.com/in/...' },
  { label: 'Website / Portfolio', name: 'website', type: 'url', required: false, selector: '', placeholder: '' },
  { label: 'Location (City, Country)', name: 'location', type: 'text', required: false, selector: '', placeholder: '' },
  { label: 'Resume / CV Upload', name: 'resume', type: 'file', required: true, selector: '', placeholder: 'Upload your resume PDF/DOCX' },
  { label: 'Cover Letter', name: 'cover_letter', type: 'textarea', required: false, selector: '', placeholder: '' },
  { label: 'Why do you want to work here?', name: 'why_company', type: 'textarea', required: false, selector: '', placeholder: '' },
  { label: 'Work Authorization', name: 'work_authorization', type: 'select', required: false, selector: '', placeholder: '' },
  { label: 'Salary Expectation', name: 'salary_expectation', type: 'text', required: false, selector: '', placeholder: '' },
];

// Strip HTML tags and normalise whitespace
function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Convert a name/id attribute to a readable label
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
    const key = forAttr.replace(/^[^_]+_/, '');
    if (text && key) labels[key] = labels[key] || text;
  }

  // Types to skip entirely (non-interactive or no value to draft)
  const SKIP_TYPES = new Set(['submit', 'button', 'hidden', 'reset', 'image', 'search']);

  // Extract <input> elements — note: 'file' is NOT in SKIP_TYPES; we include it as informational
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
      placeholder: type === 'file' ? 'Upload your file manually on the application page' : placeholder,
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

/**
 * Fetch a URL with manual redirect following + SSRF validation on every hop.
 * Also enforces content-type (HTML only) and response-size limits.
 */
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

    // Handle redirect responses with SSRF validation on every hop
    if ([301, 302, 303, 307, 308].includes(status)) {
      if (redirectsLeft <= 0) {
        throw new Error('TOO_MANY_REDIRECTS: exceeded 5 redirect hops');
      }
      const location = res.headers.get('location');
      if (!location) throw new Error('REDIRECT_NO_LOCATION: redirect missing Location header');

      // Resolve relative redirects against the current URL
      const nextUrl = new URL(location, currentUrl).href;

      // SSRF validation on the redirect target before following it
      await validateAndResolveUrl(nextUrl);

      currentUrl = nextUrl;
      redirectsLeft--;
      continue;
    }

    // Enforce content-type: only parse HTML responses
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && !contentType.includes('html')) {
      const err = new Error(`NON_HTML_RESPONSE: server returned ${contentType || 'unknown content-type'}`);
      err.code = 'NON_HTML';
      throw err;
    }

    // Enforce response-size limit before reading body
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      const err = new Error(`RESPONSE_TOO_LARGE: response is ${contentLength} bytes (limit: ${MAX_RESPONSE_BYTES})`);
      err.code = 'TOO_LARGE';
      throw err;
    }

    // For responses without Content-Length, read with size cap
    if (res.ok) {
      const reader = res.body?.getReader();
      if (!reader) return res; // fallback for environments without streaming
      const chunks = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          reader.cancel();
          const err = new Error(`RESPONSE_TOO_LARGE: exceeded ${MAX_RESPONSE_BYTES} bytes while reading`);
          err.code = 'TOO_LARGE';
          throw err;
        }
        chunks.push(value);
      }
      // Reassemble into a Response-like object with the text
      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
      const text = new TextDecoder().decode(combined);
      return { ok: true, status: res.status, _text: text };
    }

    return res;
  }
}

export async function inspectForm(url) {
  let html = '';
  let fetchError = null;
  let fetchErrorCode = 'FETCH_ERROR';
  let detectionType = 'detected';

  try {
    const res = await safeFetch(url);

    if (!res.ok) {
      const status = res.status;
      if (status === 401 || status === 403) {
        return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'AUTH_WALL' };
      }
      if (status === 404) {
        return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'NOT_FOUND' };
      }
      if (status === 429) {
        return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'RATE_LIMITED' };
      }
      if (status >= 500) {
        return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'SERVER_ERROR' };
      }
      fetchError = `HTTP_${status}`;
      fetchErrorCode = `HTTP_${status}`;
    } else {
      html = res._text ?? await res.text();
    }
  } catch (err) {
    const msg = err.message || '';
    const code = err.code || '';

    // SSRF / URL validation errors: re-throw so the route can return a 400
    if (
      msg.includes('private') || msg.includes('reserved') ||
      msg.includes('invalid url') || msg.includes('only http') ||
      msg.startsWith('TOO_MANY_REDIRECTS') || msg.startsWith('REDIRECT_NO_LOCATION')
    ) {
      throw err;
    }

    if (msg.includes('timeout') || msg.includes('aborted')) {
      return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'TIMEOUT' };
    }
    if (code === 'TOO_LARGE' || msg.includes('TOO_LARGE')) {
      return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'RESPONSE_TOO_LARGE' };
    }
    if (code === 'NON_HTML' || msg.includes('NON_HTML')) {
      return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'NON_HTML_RESPONSE' };
    }

    fetchError = msg;
    fetchErrorCode = 'FETCH_ERROR';
  }

  if (fetchError) {
    return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: fetchErrorCode };
  }

  // Detect JS-rendered forms that won't have fields in the static HTML
  const lowerHtml = html.toLowerCase();
  const hasReactRoot = lowerHtml.includes('id="root"') || lowerHtml.includes('id="app"') || lowerHtml.includes('__next');
  const hasFormTag = /<form[\s>]/i.test(html);
  const hasInputs = /<input/i.test(html);

  if (!hasFormTag && !hasInputs) {
    return {
      fields: COMMON_ATS_FIELDS,
      detectionType: 'fallback',
      error: hasReactRoot ? 'JS_REQUIRED' : 'NO_FORM',
    };
  }

  const detectedFields = parseFormFields(html);

  // Separate file-upload sentinels from fillable fields for counting purposes
  const fillableFields = detectedFields.filter(f => f.type !== 'file' && (f.label || f.name));
  const uploadFields = detectedFields.filter(f => f.type === 'file' && (f.label || f.name));

  if (fillableFields.length < 2) {
    // Not enough detected fields — fall back and append any detected upload fields
    const base = [...COMMON_ATS_FIELDS];
    for (const uf of uploadFields) {
      if (!base.some(b => b.type === 'file')) base.splice(7, 0, uf);
    }
    return { fields: base, detectionType: 'fallback', error: null };
  }

  // Return detected fillable fields + any detected upload fields at the front
  detectionType = 'detected';
  const allFields = [...uploadFields, ...fillableFields];
  return { fields: allFields, detectionType, error: null };
}
