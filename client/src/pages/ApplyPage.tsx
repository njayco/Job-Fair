import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import {
  getApplication, prepareApply, fillApply,
  generateTailoredResumePdf, downloadBlob,
  getApplyAttempts, getApplyAttempt, deleteApplyAttempt,
} from '../api';
import type { Application, FormField, ApplyPrepareResponse, ApplyAttempt } from '../api';
import {
  Send, ChevronLeft, ExternalLink, AlertCircle, CheckCircle, Copy, Check,
  Sparkles, FileText, Info, ClipboardList, ShieldAlert, Download, FileDown,
  Mail, BookOpen, History, RotateCcw, Trash2,
} from 'lucide-react';

// ── Step indicator ─────────────────────────────────────────────────────────────

function Steps({ step }: { step: number }) {
  const steps = ['Overview', 'AI Drafting', 'Review', 'Apply'];
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
            i + 1 === step
              ? 'bg-[var(--color-primary)] text-white'
              : i + 1 < step
              ? 'bg-[var(--color-green-indicator)]/15 text-[var(--color-green-indicator)]'
              : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
          }`}>
            {i + 1 < step ? <CheckCircle className="w-3 h-3" /> : <span>{i + 1}</span>}
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-6 h-px mx-1 ${i + 1 < step ? 'bg-[var(--color-green-indicator)]/40' : 'bg-[var(--color-border)]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Field type badge ───────────────────────────────────────────────────────────

function FieldTypeBadge({ type }: { type: string }) {
  const color = type === 'textarea'
    ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10'
    : type === 'select'
    ? 'text-[var(--color-yellow-indicator)] bg-[var(--color-yellow-indicator)]/10'
    : 'text-[var(--color-text-muted)] bg-[var(--color-bg)]';
  return (
    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border border-[var(--color-border)] ${color}`}>
      {type}
    </span>
  );
}

// ── Editable field card ────────────────────────────────────────────────────────

function FieldCard({ field, index, onChange }: {
  field: FormField;
  index: number;
  onChange: (val: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(field.approved_value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const isFileUpload = field.type === 'file';
  const isEmpty = !isFileUpload && !field.approved_value?.trim();

  if (isFileUpload) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-yellow-indicator)]/30 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0">{index + 1}.</span>
          <span className="text-sm font-medium text-[var(--color-text)]">{field.label}</span>
          <FieldTypeBadge type="file" />
          {field.required && (
            <span className="shrink-0 text-[9px] font-mono text-[var(--color-accent)] border border-[var(--color-accent)]/30 px-1 py-0.5 rounded">
              required
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--color-yellow-indicator)] flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          File upload field — download your tailored resume &amp; cover letter from the Documents tab, then attach them here when you open the form.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-[var(--color-surface)] border rounded-xl p-4 space-y-2 transition-colors ${
      isEmpty && field.required
        ? 'border-[var(--color-yellow-indicator)]/40'
        : 'border-[var(--color-border)]'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0">{index + 1}.</span>
          <span className="text-sm font-medium text-[var(--color-text)] truncate">{field.label}</span>
          <FieldTypeBadge type={field.type} />
          {field.required && (
            <span className="shrink-0 text-[9px] font-mono text-[var(--color-accent)] border border-[var(--color-accent)]/30 px-1 py-0.5 rounded">
              required
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          disabled={isEmpty}
          title="Copy to clipboard"
          className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors disabled:opacity-30"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-green-indicator)]" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      {field.type === 'textarea' ? (
        <textarea
          rows={4}
          value={field.approved_value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors resize-y min-h-[80px] font-sans"
          placeholder={field.placeholder || `Enter your ${field.label.toLowerCase()}…`}
        />
      ) : (
        <input
          type="text"
          value={field.approved_value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          placeholder={field.placeholder || `Enter your ${field.label.toLowerCase()}…`}
        />
      )}
      {isEmpty && field.required && (
        <p className="text-xs text-[var(--color-yellow-indicator)] flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Required — fill this in before applying
        </p>
      )}
    </div>
  );
}

// ── Document card (resume or cover letter) ────────────────────────────────────

function DocumentCard({
  title, icon: Icon, content, onContentChange,
  rows, onDownloadText, textFilename, onDownloadPdf, pdfLoading,
}: {
  title: string;
  icon: React.ElementType;
  content: string;
  onContentChange: (v: string) => void;
  rows: number;
  onDownloadText: () => void;
  textFilename: string;
  onDownloadPdf?: () => void;
  pdfLoading?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  const isEmpty = !content.trim();

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="font-mono font-semibold text-sm text-[var(--color-text)]">{title}</h3>
          {isEmpty && (
            <span className="text-[10px] font-mono text-[var(--color-yellow-indicator)] border border-[var(--color-yellow-indicator)]/30 px-1.5 py-0.5 rounded">
              not generated
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            disabled={isEmpty}
            title="Copy to clipboard"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors disabled:opacity-30"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-green-indicator)]" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={onDownloadText}
            disabled={isEmpty}
            title={`Download ${textFilename}`}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors disabled:opacity-30"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">.md</span>
          </button>
          {onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              disabled={isEmpty || pdfLoading}
              title="Download as PDF"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors disabled:opacity-40"
            >
              {pdfLoading ? (
                <span className="w-3.5 h-3.5 border border-[var(--color-primary)]/40 border-t-[var(--color-primary)] rounded-full animate-spin inline-block" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              {pdfLoading ? 'Generating…' : 'PDF'}
            </button>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div className="flex items-start gap-2 py-4 text-xs text-[var(--color-text-muted)]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-yellow-indicator)]" />
          Claude could not generate this document. You can type or paste your own content below.
        </div>
      ) : null}

      <textarea
        rows={rows}
        value={content}
        onChange={e => onContentChange(e.target.value)}
        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors resize-y font-sans leading-relaxed"
        placeholder={`Your ${title.toLowerCase()} will appear here…`}
        spellCheck
      />
      <p className="text-xs text-[var(--color-text-muted)]">
        AI-generated — review and edit before downloading or uploading.
      </p>
    </div>
  );
}

// ── Copy-all answers panel ─────────────────────────────────────────────────────

function CopyPanel({ fields, url }: { fields: FormField[]; url: string }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyOne = async (val: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch { /* ignore */ }
  };

  const handleCopyAll = async () => {
    const text = fields
      .filter(f => f.approved_value?.trim())
      .map(f => `### ${f.label}\n${f.approved_value}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch { /* ignore */ }
  };

  const answerFields = fields.filter(f => f.type !== 'file' && f.approved_value?.trim());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-mono font-semibold hover:opacity-90 transition-opacity"
        >
          <ExternalLink className="w-4 h-4" />
          OPEN APPLICATION FORM
        </a>
        {answerFields.length > 0 && (
          <button
            onClick={handleCopyAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/40 transition-colors"
          >
            {copiedAll ? <Check className="w-4 h-4 text-[var(--color-green-indicator)]" /> : <Copy className="w-4 h-4" />}
            {copiedAll ? 'COPIED ALL' : 'COPY ALL ANSWERS'}
          </button>
        )}
      </div>

      {answerFields.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No text answers to show — open the form and fill it in using the documents above.</p>
      ) : (
        <div className="space-y-3">
          {answerFields.map((f, i) => (
            <div key={f.name || i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">{i + 1}.</span>
                  <span className="text-sm font-medium text-[var(--color-text)]">{f.label}</span>
                  {f.required && <span className="text-[9px] font-mono text-[var(--color-accent)] border border-[var(--color-accent)]/30 px-1 py-0.5 rounded">required</span>}
                </div>
                <button
                  onClick={() => handleCopyOne(f.approved_value, i)}
                  className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
                >
                  {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-[var(--color-green-indicator)]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className={`text-sm text-[var(--color-text)] rounded-lg px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] ${
                f.type === 'textarea' ? 'whitespace-pre-wrap' : ''
              }`}>
                {f.approved_value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--color-text-muted)]">
          Career-Ops never submits anything on your behalf. You control the final submission. Always review AI-drafted answers before sending.
        </p>
      </div>
    </div>
  );
}

// ── Document downloads panel (step 4) ─────────────────────────────────────────

function DocumentDownloadPanel({
  tailoredResume, coverLetter,
  company, onDownloadResumePdf,
  pdfLoading,
}: {
  tailoredResume: string;
  coverLetter: string;
  company: string;
  onDownloadResumePdf: () => void;
  pdfLoading: boolean;
}) {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const date = new Date().toISOString().split('T')[0];

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
    downloadBlob(blob, filename);
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4 text-[var(--color-primary)]" />
        <h3 className="font-mono font-semibold text-sm">Files to Attach</h3>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Download these files and upload them to the application form's file upload fields.
      </p>

      <div className="grid gap-3">
        {/* Tailored Resume */}
        <div className="flex items-center justify-between gap-3 p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">Tailored Resume</p>
              <p className="text-xs text-[var(--color-text-muted)]">Optimized for this role by AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => downloadText(tailoredResume, `resume-${slug}-${date}.md`)}
              disabled={!tailoredResume}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/30 transition-colors disabled:opacity-30"
            >
              <Download className="w-3 h-3" /> .md
            </button>
            <button
              onClick={onDownloadResumePdf}
              disabled={!tailoredResume || pdfLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {pdfLoading ? (
                <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin inline-block" />
              ) : (
                <FileDown className="w-3 h-3" />
              )}
              {pdfLoading ? 'Generating…' : 'PDF'}
            </button>
          </div>
        </div>

        {/* Cover Letter */}
        <div className="flex items-center justify-between gap-3 p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">Cover Letter</p>
              <p className="text-xs text-[var(--color-text-muted)]">AI-written, tailored to this role</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CoverLetterCopyBtn coverLetter={coverLetter} />
            <button
              onClick={() => downloadText(coverLetter, `cover-letter-${slug}-${date}.txt`)}
              disabled={!coverLetter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Download className="w-3 h-3" /> .txt
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 pt-1">
        <Info className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--color-text-muted)]">
          If the form doesn't have a file upload, paste the cover letter text into the cover letter text field instead.
        </p>
      </div>
    </div>
  );
}

function CoverLetterCopyBtn({ coverLetter }: { coverLetter: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };
  return (
    <button
      onClick={handleCopy}
      disabled={!coverLetter}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/30 transition-colors disabled:opacity-30"
    >
      {copied ? <Check className="w-3 h-3 text-[var(--color-green-indicator)]" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type PageStep = 1 | 2 | 3 | 4;
type DocTab = 'documents' | 'fields';

export default function ApplyPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const appId = parseInt(applicationId || '0', 10);
  const location = useLocation();
  const fromScanner = location.state?.from === 'scanner';
  const scannerCtx = fromScanner
    ? (location.state as { jobUrl: string; jobTitle: string; company: string; cvContent?: string; applicationId: number | null })
    : null;

  const autoLaunchedRef = useRef(false);

  const [app, setApp] = useState<Application | null>(null);
  const [appLoading, setAppLoading] = useState(true);
  const [appError, setAppError] = useState('');

  const [step, setStep] = useState<PageStep>(1);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState('');
  const [draft, setDraft] = useState<ApplyPrepareResponse | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);

  const [tailoredResume, setTailoredResume] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [docTab, setDocTab] = useState<DocTab>('documents');
  const [pdfLoading, setPdfLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [attempts, setAttempts] = useState<ApplyAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [loadingAttemptId, setLoadingAttemptId] = useState<number | null>(null);
  const [deletingAttemptId, setDeletingAttemptId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteToast, setDeleteToast] = useState<{ message: string; isError?: boolean } | null>(null);

  // Load application
  useEffect(() => {
    if (!appId) { setAppError('Invalid application ID'); setAppLoading(false); return; }
    getApplication(appId)
      .then(a => setApp(a))
      .catch(e => setAppError(e.message || 'Application not found'))
      .finally(() => setAppLoading(false));
  }, [appId]);

  // Load previous attempts
  useEffect(() => {
    if (!appId) return;
    setAttemptsLoading(true);
    getApplyAttempts(appId)
      .then(r => setAttempts(r.attempts))
      .catch(() => setAttempts([]))
      .finally(() => setAttemptsLoading(false));
  }, [appId]);

  const handleLoadAttempt = useCallback(async (attempt: ApplyAttempt) => {
    if (!app) return;
    setLoadingAttemptId(attempt.id);
    try {
      const detail = await getApplyAttempt(appId, attempt.id);
      const loadedFields: FormField[] = Array.isArray(detail.fields_json) ? detail.fields_json : [];
      setDraft({
        attempt_id: detail.id,
        application_id: appId,
        url: detail.url,
        company: detail.company,
        role: detail.role,
        fields: loadedFields,
        detection_type: 'loaded',
        detection_error: null,
        tailored_resume: detail.tailored_resume || '',
        cover_letter: detail.cover_letter || '',
        created_at: detail.created_at,
      });
      setFields(loadedFields);
      setPrepareError('');
      setStep(3);
    } catch (e) {
      setPrepareError(e instanceof Error ? e.message : 'Failed to load previous attempt');
    } finally {
      setLoadingAttemptId(null);
    }
  }, [appId, app]);

  const handleDeleteAttempt = useCallback(async (attemptId: number) => {
    setConfirmDeleteId(null);
    setDeletingAttemptId(attemptId);
    try {
      await deleteApplyAttempt(appId, attemptId);
      setAttempts(prev => prev.filter(a => a.id !== attemptId));
      setDeleteToast({ message: 'Session deleted' });
      setTimeout(() => setDeleteToast(null), 3000);
    } catch (e) {
      setDeleteToast({ message: e instanceof Error ? e.message : 'Failed to delete session', isError: true });
      setTimeout(() => setDeleteToast(null), 4000);
    } finally {
      setDeletingAttemptId(null);
    }
  }, [appId]);

  const handleLaunch = useCallback(async () => {
    if (!appId) return;
    setPreparing(true);
    setPrepareError('');
    setStep(2);
    try {
      const result = await prepareApply(appId, scannerCtx?.cvContent || undefined);
      setDraft(result);
      setFields(result.fields);
      setTailoredResume(result.tailored_resume || '');
      setCoverLetter(result.cover_letter || '');
      setDocTab('documents');
      setStep(3);
    } catch (e: unknown) {
      const err = e as Error & { error_type?: string };
      setPrepareError(err.message || 'Preparation failed');
      setStep(1);
    } finally {
      setPreparing(false);
    }
  }, [appId, scannerCtx?.cvContent]);

  // Auto-launch prepare flow when navigating from the Scanner for any job
  // (evaluated jobs have full context; unevaluated have just URL + CV).
  useEffect(() => {
    if (!fromScanner || autoLaunchedRef.current || appLoading || !app || step !== 1 || preparing) return;
    autoLaunchedRef.current = true;
    handleLaunch();
  }, [fromScanner, appLoading, app, step, preparing, handleLaunch]);

  const handleFieldChange = (index: number, value: string) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, approved_value: value } : f));
  };

  const handleSaveAndProceed = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError('');
    try {
      await fillApply(draft.attempt_id, fields, tailoredResume, coverLetter);
      setStep(4);
      setTimeout(() => {
        document.getElementById('apply-panel-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save answers');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadResumePdf = async () => {
    if (!tailoredResume || pdfLoading) return;
    setPdfLoading(true);
    try {
      const blob = await generateTailoredResumePdf(tailoredResume, appId);
      const slug = (draft?.company || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const date = new Date().toISOString().split('T')[0];
      downloadBlob(blob, `resume-${slug}-${date}.pdf`);
    } catch (e) {
      console.error('PDF generation failed:', e);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadResumeText = () => {
    if (!tailoredResume) return;
    const slug = (draft?.company || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const date = new Date().toISOString().split('T')[0];
    const blob = new Blob([tailoredResume], { type: 'text/plain; charset=utf-8' });
    downloadBlob(blob, `resume-${slug}-${date}.md`);
  };

  const handleDownloadCoverLetter = () => {
    if (!coverLetter) return;
    const slug = (draft?.company || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const date = new Date().toISOString().split('T')[0];
    const blob = new Blob([coverLetter], { type: 'text/plain; charset=utf-8' });
    downloadBlob(blob, `cover-letter-${slug}-${date}.txt`);
  };

  // ── Loading / Error states ─────────────────────────────────────────────────

  if (appLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto space-y-8">
          <Link
            to={fromScanner ? '/scanner' : '/pipeline'}
            className="inline-flex items-center text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {fromScanner ? 'Back to Scanner' : 'Back to Pipeline'}
          </Link>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Send className="w-6 h-6 text-[var(--color-primary)]" />
              <h1 className="text-2xl font-bold font-mono tracking-tight">Assisted Apply</h1>
            </div>
            {scannerCtx ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-lg font-semibold text-[var(--color-text)]">{scannerCtx.company}</span>
                <span className="text-[var(--color-text-muted)] hidden sm:inline">—</span>
                <span className="text-[var(--color-text-muted)]">{scannerCtx.jobTitle}</span>
              </div>
            ) : null}
            <Steps step={1} />
          </div>
          <div className="py-12 text-center font-mono text-[var(--color-text-muted)] animate-pulse">
            {fromScanner ? 'Preparing your application…' : 'Loading…'}
          </div>
        </div>
      </Layout>
    );
  }

  if (appError || !app) {
    return (
      <Layout>
        <div className="py-24 text-center font-mono text-[var(--color-red-indicator)]">
          {appError || 'Application not found'}
          <div className="mt-4">
            <Link to="/pipeline" className="text-sm text-[var(--color-primary)] underline">Back to pipeline</Link>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Back link */}
        <Link
          to={fromScanner ? '/scanner' : `/results/${appId}`}
          className="inline-flex items-center text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {fromScanner ? 'Back to Scanner' : 'Back to Results'}
        </Link>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Send className="w-6 h-6 text-[var(--color-primary)]" />
            <h1 className="text-2xl font-bold font-mono tracking-tight">Assisted Apply</h1>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-lg font-semibold text-[var(--color-text)]">{app.company}</span>
            <span className="text-[var(--color-text-muted)] hidden sm:inline">—</span>
            <span className="text-[var(--color-text-muted)]">{app.role}</span>
            {app.url && (
              <a
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> View job
              </a>
            )}
          </div>
          <Steps step={step} />
        </div>

        {/* ── Step 1: Overview ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold font-mono">How it works</h2>
              <div className="space-y-3">
                {[
                  { icon: FileText,    text: 'We fetch the application form and detect its fields', color: 'text-[var(--color-primary)]' },
                  { icon: BookOpen,    text: 'Claude tailors your resume specifically for this role — keywords, reordered highlights, sharpened summary', color: 'text-[var(--color-primary)]' },
                  { icon: Mail,        text: 'Claude writes a compelling cover letter based on your experience, achievements, and the job description', color: 'text-[var(--color-primary)]' },
                  { icon: Sparkles,    text: 'Claude drafts an answer for every form field based on your CV and evaluation', color: 'text-[var(--color-primary)]' },
                  { icon: ClipboardList, text: 'You review and edit everything — resume, cover letter, and all answers', color: 'text-[var(--color-primary)]' },
                  { icon: CheckCircle, text: 'Download your documents, open the form, attach the files and paste your answers — you click submit', color: 'text-[var(--color-green-indicator)]' },
                ].map(({ icon: Icon, text, color }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full border border-[var(--color-border)] flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-sm text-[var(--color-text)]">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl flex items-start gap-3">
              <Info className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--color-text-muted)]">
                <strong className="text-[var(--color-text)]">This does not submit your application.</strong>{' '}
                You always review everything and click submit yourself. Career-Ops never acts on your behalf.
              </p>
            </div>

            {!app.url && (
              <div className="p-4 bg-[var(--color-yellow-indicator)]/5 border border-[var(--color-yellow-indicator)]/30 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[var(--color-yellow-indicator)] shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--color-yellow-indicator)]">
                  No application URL saved. Add one on the{' '}
                  <Link to="/pipeline" className="underline">Pipeline page</Link> first.
                </p>
              </div>
            )}

            {/* Previous attempts */}
            {(attemptsLoading || attempts.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <h3 className="text-sm font-semibold font-mono text-[var(--color-text-muted)] uppercase tracking-wide">
                    Previous Sessions
                  </h3>
                </div>
                {attemptsLoading ? (
                  <p className="text-xs text-[var(--color-text-muted)] animate-pulse font-mono">Loading history…</p>
                ) : (
                  <div className="space-y-2">
                    {attempts.map(attempt => (
                      <div
                        key={attempt.id}
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                              attempt.status === 'filled'
                                ? 'text-[var(--color-green-indicator)] border-[var(--color-green-indicator)]/30 bg-[var(--color-green-indicator)]/5'
                                : 'text-[var(--color-text-muted)] border-[var(--color-border)] bg-[var(--color-bg)]'
                            }`}>
                              {attempt.status.toUpperCase()}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)] font-mono">
                              {attempt.field_count} field{attempt.field_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {new Date(attempt.created_at).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {confirmDeleteId === attempt.id ? (
                            <>
                              <span className="text-[10px] font-mono text-[var(--color-text-muted)] hidden sm:inline">Delete?</span>
                              <button
                                onClick={() => handleDeleteAttempt(attempt.id)}
                                disabled={deletingAttemptId === attempt.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border border-[var(--color-red-indicator)]/40 text-[var(--color-red-indicator)] hover:bg-[var(--color-red-indicator)]/5 transition-colors disabled:opacity-50"
                              >
                                {deletingAttemptId === attempt.id ? (
                                  <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
                                ) : (
                                  'YES'
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={deletingAttemptId === attempt.id}
                                className="inline-flex items-center px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
                              >
                                NO
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleLoadAttempt(attempt)}
                                disabled={loadingAttemptId === attempt.id || deletingAttemptId === attempt.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border border-[var(--color-primary)]/40 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors disabled:opacity-50"
                              >
                                {loadingAttemptId === attempt.id ? (
                                  <>
                                    <div className="w-3 h-3 border border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" />
                                    LOADING…
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-3 h-3" />
                                    LOAD
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(attempt.id)}
                                disabled={deletingAttemptId === attempt.id || loadingAttemptId === attempt.id}
                                title="Delete session"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-red-indicator)]/40 hover:text-[var(--color-red-indicator)] hover:bg-[var(--color-red-indicator)]/5 transition-colors disabled:opacity-40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {prepareError && (
              <div className="p-4 bg-[var(--color-red-indicator)]/5 border border-[var(--color-red-indicator)]/30 rounded-xl flex items-start gap-3 text-sm text-[var(--color-red-indicator)]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {prepareError}
              </div>
            )}

            <Button
              onClick={handleLaunch}
              disabled={!app.url || preparing}
              variant="primary"
              className="gap-2 font-mono"
            >
              <Sparkles className="w-4 h-4" />
              LAUNCH FORM ASSISTANT
            </Button>
          </div>
        )}

        {/* ── Step 2: Loading ── */}
        {step === 2 && (
          <div className="py-16 text-center space-y-6">
            <div className="flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] animate-spin" />
            </div>
            <div className="space-y-3">
              <p className="font-mono text-[var(--color-text)]">Preparing your application…</p>
              <div className="text-sm text-[var(--color-text-muted)] space-y-1">
                <p>• Inspecting the application form</p>
                <p>• Tailoring your resume for this role</p>
                <p>• Writing a cover letter</p>
                <p>• Drafting answers to every field</p>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] pt-2">Usually takes 20–45 seconds</p>
            </div>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && draft && (
          <div className="space-y-5">
            {/* Detection banner */}
            {draft.detection_type === 'fallback' && (
              <div className="p-4 bg-[var(--color-yellow-indicator)]/5 border border-[var(--color-yellow-indicator)]/30 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[var(--color-yellow-indicator)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-yellow-indicator)]">
                    {draft.detection_error === 'AUTH_WALL'         ? 'Login required — could not read form' :
                     draft.detection_error === 'JS_REQUIRED'       ? 'JavaScript-rendered form — could not parse statically or via Jina' :
                     draft.detection_error === 'TIMEOUT'           ? 'Form page timed out' :
                     draft.detection_error === 'NOT_FOUND'         ? 'Form page returned 404 — check the URL' :
                     draft.detection_error === 'RATE_LIMITED'      ? 'Rate limited by the application portal' :
                     draft.detection_error === 'SERVER_ERROR'      ? 'Application portal returned a server error' :
                     draft.detection_error === 'RESPONSE_TOO_LARGE' ? 'Page too large to parse' :
                     draft.detection_error === 'NON_HTML_RESPONSE' ? 'Page did not return HTML' :
                     draft.detection_error?.startsWith('HTTP_')   ? `Portal returned ${draft.detection_error.replace('HTTP_', 'HTTP ')}` :
                     'Could not detect form fields'}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Using standard ATS fields instead — your tailored resume, cover letter, and common answers are still ready.{' '}
                    <a href={draft.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline hover:no-underline">Open the form</a>
                    {' '}to see what's actually required.
                  </p>
                </div>
              </div>
            )}

            {draft.detection_type === 'jina' && (
              <div className="p-4 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl flex items-start gap-3">
                <Info className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-primary)]">
                    Fields detected via rendered page snapshot
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    The portal uses JavaScript rendering, so we used a text snapshot to find custom fields on top of the standard ATS set.
                    {' '}<a href={draft.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline hover:no-underline">Open the form</a>
                    {' '}to confirm all fields are covered.
                  </p>
                </div>
              </div>
            )}

            {draft.detection_type === 'detected' && (
              <div className="p-4 bg-[var(--color-green-indicator)]/5 border border-[var(--color-green-indicator)]/30 rounded-xl flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-[var(--color-green-indicator)] shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--color-green-indicator)]">
                  {fields.length} form fields detected and pre-filled. Your resume and cover letter are also ready to download.
                </p>
              </div>
            )}

            {/* Tab bar */}
            <div className="flex items-center gap-1 border-b border-[var(--color-border)] pb-0">
              {([
                { key: 'documents', label: 'Documents', icon: BookOpen },
                { key: 'fields',    label: `Form Answers (${fields.filter(f => f.type !== 'file').length})`, icon: ClipboardList },
              ] as { key: DocTab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setDocTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-mono transition-colors border-b-2 -mb-px ${
                    docTab === key
                      ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Documents tab */}
            {docTab === 'documents' && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Review and edit both documents — then download them and attach to the application form. The cover letter is also pre-filled into any cover letter form fields.
                </p>
                <DocumentCard
                  title="Cover Letter"
                  icon={Mail}
                  content={coverLetter}
                  onContentChange={setCoverLetter}
                  rows={14}
                  onDownloadText={handleDownloadCoverLetter}
                  textFilename="cover-letter.txt"
                />
                <DocumentCard
                  title="Tailored Resume"
                  icon={BookOpen}
                  content={tailoredResume}
                  onContentChange={setTailoredResume}
                  rows={24}
                  onDownloadText={handleDownloadResumeText}
                  textFilename="resume.md"
                  onDownloadPdf={handleDownloadResumePdf}
                  pdfLoading={pdfLoading}
                />
              </div>
            )}

            {/* Form answers tab */}
            {docTab === 'fields' && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Claude pre-filled these based on your CV. Edit anything that needs adjusting — you know your story best.
                </p>
                {fields.map((f, i) => (
                  <FieldCard
                    key={f.name || i}
                    field={f}
                    index={i}
                    onChange={val => handleFieldChange(i, val)}
                  />
                ))}
              </div>
            )}

            {saveError && (
              <div className="p-3 bg-[var(--color-red-indicator)]/5 border border-[var(--color-red-indicator)]/30 rounded-lg text-sm text-[var(--color-red-indicator)]">
                {saveError}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2 border-t border-[var(--color-border)]">
              <Button
                onClick={handleSaveAndProceed}
                disabled={saving}
                variant="primary"
                className="gap-2 font-mono"
              >
                <CheckCircle className="w-4 h-4" />
                {saving ? 'SAVING…' : "LOOKS GOOD — SHOW ME HOW TO APPLY"}
              </Button>
              <p className="text-xs text-[var(--color-text-muted)] self-center">
                Saves everything and opens the apply panel.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 4: Apply ── */}
        {step === 4 && draft && (
          <div id="apply-panel-top" className="space-y-6">
            <div className="p-4 bg-[var(--color-green-indicator)]/5 border border-[var(--color-green-indicator)]/30 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[var(--color-green-indicator)] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-green-indicator)]">Everything is ready — time to apply!</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Download your documents, open the form, attach the files, and paste your answers. The final submit is always yours.
                </p>
              </div>
            </div>

            {/* Step 4a: File attachments */}
            <div className="space-y-2">
              <h2 className="text-base font-bold font-mono flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs flex items-center justify-center font-bold">1</span>
                Download &amp; Attach Your Documents
              </h2>
            </div>
            <DocumentDownloadPanel
              tailoredResume={tailoredResume}
              coverLetter={coverLetter}
              company={draft.company}
              onDownloadResumePdf={handleDownloadResumePdf}
              pdfLoading={pdfLoading}
            />

            {/* Step 4b: Form answers */}
            <div className="space-y-2">
              <h2 className="text-base font-bold font-mono flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs flex items-center justify-center font-bold">2</span>
                Copy &amp; Paste Your Form Answers
              </h2>
            </div>
            <CopyPanel
              fields={fields}
              url={draft.url}
            />
          </div>
        )}

      </div>

      {/* Delete toast */}
      {deleteToast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[var(--color-surface)] border rounded-xl shadow-lg flex items-center gap-2 text-sm font-mono ${
          deleteToast.isError
            ? 'border-[var(--color-red-indicator)]/40 text-[var(--color-red-indicator)]'
            : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
        }`}>
          {deleteToast.isError ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 text-[var(--color-green-indicator)] shrink-0" />
          )}
          {deleteToast.message}
        </div>
      )}

    </Layout>
  );
}
