/**
 * formInspector.js
 * Fetches a job application URL and attempts to detect form fields from the HTML.
 * Falls back to Jina Reader (r.jina.ai) for JS-rendered ATS portals, then to
 * common ATS fields when the page is inaccessible or yields no form structure.
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

// Normalised label set from the common fields, used for deduplication.
const COMMON_LABEL_NORMS = new Set(
  COMMON_ATS_FIELDS.map(f => f.label.toLowerCase().replace(/[^a-z0-9]/g, ''))
);

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

// ── Jina Reader integration ────────────────────────────────────────────────────

/**
 * Fetch a rendered text snapshot of a URL via Jina Reader (r.jina.ai).
 * Returns the plain-text/markdown body, or null on failure.
 */
async function fetchJinaSnapshot(url) {
  try {
    // Encode the URL so special characters in the path/query don't break the Jina endpoint
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const res = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain, text/markdown',
        'X-Timeout': '15',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Infer the most likely field type from a label string.
 */
function inferFieldType(label) {
  const l = label.toLowerCase();
  if (/\b(email|e-mail)\b/.test(l)) return 'email';
  if (/\b(phone|tel|mobile|cell)\b/.test(l)) return 'tel';
  if (/\b(url|website|portfolio|linkedin|github|profile link)\b/.test(l)) return 'url';
  if (/\b(resume|cv|upload|attach|file)\b/.test(l)) return 'file';
  if (/\b(cover letter|cover note|motivation|essay|statement|describe|explain|tell us|summary|experience|why|how|what|background)\b/.test(l)) return 'textarea';
  if (/\b(country|state|pronoun|gender|veteran|disability|ethnicity|race|citizenship|authorization|visa|relocat|department|team|source|referral|salary|compensation)\b/.test(l)) return 'select';
  return 'text';
}

/**
 * Words/phrases that indicate a line is navigation, boilerplate, or a heading
 * rather than a form field label.
 */
const NOISE_PATTERNS = [
  /^(apply|submit|save|cancel|next|back|continue|sign in|log in|create account|privacy|terms|cookie)/i,
  /^(jobs?|careers?|home|about|contact|menu|navigation|search results)/i,
  /^\d+$/, // pure numbers
  /^[^a-z]+$/i, // no letters at all
];

/**
 * Parse candidate form field labels from a Jina-rendered text snapshot.
 * Returns an array of { label, name, type, required, selector, placeholder }
 * objects for fields that appear custom / not already in COMMON_ATS_FIELDS.
 */
function parseJinaFields(snapshot) {
  const lines = snapshot
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const candidateLabels = [];
  const seen = new Set();

  for (const raw of lines) {
    // Strip markdown formatting: ##, **, *, >, -, bullets, leading numbers like "1."
    let line = raw
      .replace(/^#+\s*/, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^[-•▸▶]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^>\s+/, '')
      .trim();

    // Detect and strip trailing required asterisk/marker
    const required = /\s*\*\s*$/.test(line) || /\(required\)/i.test(line);
    line = line.replace(/\s*\*\s*$/, '').replace(/\s*\(required\)\s*$/i, '').trim();

    // Skip blank, very long (paragraph), or very short (single char) lines
    if (!line || line.length < 3 || line.length > 80) continue;

    // Skip lines with too many words (likely a sentence/paragraph, not a label)
    const wordCount = line.split(/\s+/).length;
    if (wordCount > 8) continue;

    // Skip noise patterns (navigation, boilerplate)
    if (NOISE_PATTERNS.some(p => p.test(line))) continue;

    // Skip lines that look like URLs or email addresses
    if (/^https?:\/\//.test(line) || /^[^\s]+@[^\s]+\.[^\s]+$/.test(line)) continue;

    // Normalise for deduplication / comparison with common fields
    const norm = line.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);

    // Skip if this is essentially a common ATS field (already covered)
    if (COMMON_LABEL_NORMS.has(norm)) continue;

    // Require at least one letter
    if (!/[a-zA-Z]/.test(line)) continue;

    const type = inferFieldType(line);
    const nameSlug = line.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    candidateLabels.push({
      label: line,
      name: nameSlug,
      type,
      required,
      selector: '',
      placeholder: type === 'file' ? 'Upload your file manually on the application page' : '',
    });
  }

  return candidateLabels;
}

/**
 * Determine whether Jina-extracted fields contain meaningful custom fields
 * (i.e., fields not already in the common ATS list).
 */
function hasCustomFields(jinaFields) {
  return jinaFields.some(f => {
    const norm = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !COMMON_LABEL_NORMS.has(norm);
  });
}

// ── SSRF-safe fetcher ─────────────────────────────────────────────────────────

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

// ── Main inspector ────────────────────────────────────────────────────────────

/**
 * Inspect a job application URL for form fields.
 *
 * Detection chain:
 *   1. Static HTML fetch + regex parse
 *   2. Jina Reader rendered-snapshot parse (JS-rendered portals)
 *   3. Common ATS field fallback
 *
 * SECURITY NOTE: Callers MUST validate `url` against private/reserved IP ranges
 * (e.g. via `validateAndResolveUrl`) before calling this function to prevent
 * SSRF. The current call site in `server/routes/apply.js` enforces this; any
 * future call sites must do the same.
 *
 * @param {string} url - The job application URL (already SSRF-validated by caller).
 * @returns {{ fields: object[], detectionType: string, error: string|null }}
 */
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
        return tryJinaFallback(url, 'AUTH_WALL');
      }
      if (status === 404) {
        return { fields: COMMON_ATS_FIELDS, detectionType: 'fallback', error: 'NOT_FOUND' };
      }
      if (status === 429) {
        return tryJinaFallback(url, 'RATE_LIMITED');
      }
      if (status >= 500) {
        return tryJinaFallback(url, 'SERVER_ERROR');
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
      return tryJinaFallback(url, 'TIMEOUT');
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
    return tryJinaFallback(url, fetchErrorCode);
  }

  // Detect JS-rendered forms that won't have fields in the static HTML
  const lowerHtml = html.toLowerCase();
  const hasReactRoot = lowerHtml.includes('id="root"') || lowerHtml.includes('id="app"') || lowerHtml.includes('__next');
  const hasFormTag = /<form[\s>]/i.test(html);
  const hasInputs = /<input/i.test(html);

  if (!hasFormTag && !hasInputs) {
    // JS-rendered or no form — try Jina before falling back
    const jsError = hasReactRoot ? 'JS_REQUIRED' : 'NO_FORM';
    return tryJinaFallback(url, jsError);
  }

  const detectedFields = parseFormFields(html);

  // Separate file-upload sentinels from fillable fields for counting purposes
  const fillableFields = detectedFields.filter(f => f.type !== 'file' && (f.label || f.name));
  const uploadFields = detectedFields.filter(f => f.type === 'file' && (f.label || f.name));

  if (fillableFields.length < 2) {
    // Not enough detected fields — try Jina before falling back to common list
    return tryJinaFallback(url, null, uploadFields);
  }

  // Return detected fillable fields + any detected upload fields at the front
  detectionType = 'detected';
  const allFields = [...uploadFields, ...fillableFields];
  return { fields: allFields, detectionType, error: null };
}

/**
 * Attempt to enrich field detection via Jina Reader.
 * If Jina finds custom fields, returns detectionType 'jina'.
 * Otherwise falls back to COMMON_ATS_FIELDS with detectionType 'fallback'.
 *
 * @param {string} url - The original job application URL.
 * @param {string|null} originalError - The error code that triggered this fallback.
 * @param {Array} staticUploadFields - Any file-upload fields found in static HTML.
 */
async function tryJinaFallback(url, originalError, staticUploadFields = []) {
  try {
    const snapshot = await fetchJinaSnapshot(url);

    if (snapshot) {
      const jinaFields = parseJinaFields(snapshot);

      if (jinaFields.length > 0 && hasCustomFields(jinaFields)) {
        // Jina found custom fields — merge them on top of the common base
        // Preserve any static upload fields found earlier; deduplicate by name
        const base = [...COMMON_ATS_FIELDS];

        // Inject static upload fields not already in base
        for (const uf of staticUploadFields) {
          if (!base.some(b => b.type === 'file')) base.splice(7, 0, uf);
        }

        // Append Jina-detected custom fields that don't duplicate the base
        const baseNames = new Set(base.map(f => f.name));
        for (const jf of jinaFields) {
          if (!baseNames.has(jf.name)) {
            base.push(jf);
            baseNames.add(jf.name);
          }
        }

        return {
          fields: base,
          detectionType: 'jina',
          error: originalError || null,
          jina_field_count: jinaFields.length,
        };
      }
    }
  } catch {
    // Jina unavailable or errored — silently fall through
  }

  // Final fallback: common ATS fields
  const base = [...COMMON_ATS_FIELDS];
  for (const uf of staticUploadFields) {
    if (!base.some(b => b.type === 'file')) base.splice(7, 0, uf);
  }
  return { fields: base, detectionType: 'fallback', error: originalError || null };
}
