import { createRequire } from 'module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Extract plain text from a resume buffer.
 * @param {Buffer} buffer - file contents
 * @param {string} mimetype - MIME type from multer
 * @param {string} originalname - original filename (used as fallback for type detection)
 * @returns {{ text: string }}
 */
export async function parseResume(buffer, mimetype, originalname) {
  const filename = originalname || 'resume';
  const ext = filename.toLowerCase().split('.').pop();

  if (mimetype === 'text/plain' || ext === 'txt') {
    return { text: buffer.toString('utf-8'), filename };
  }

  if (mimetype === 'application/pdf' || ext === 'pdf') {
    const data = await pdfParse(buffer);
    return { text: data.text || '', filename };
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    ext === 'docx' ||
    ext === 'doc'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value || '', filename };
  }

  throw new Error(`Unsupported file type: ${mimetype || ext}. Please upload PDF, DOCX, or TXT.`);
}

/**
 * Quick regex extraction of contact fields from resume text.
 * Returns best guesses — Claude will correct/supplement these during evaluation.
 */
export function extractContactInfo(text) {
  const emailMatch = text.match(/[\w.+'-]+@[\w-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(
    /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/
  );
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const nameLine = lines[0] || null;
  const name = nameLine && nameLine.length < 80 && !/http/i.test(nameLine) ? nameLine : null;

  return {
    parsed_name: name,
    parsed_email: emailMatch ? emailMatch[0] : null,
    parsed_phone: phoneMatch ? phoneMatch[0].trim() : null,
  };
}
