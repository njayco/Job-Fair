import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { getApplication, prepareApply, fillApply } from '../api';
import type { Application, FormField, ApplyPrepareResponse } from '../api';
import {
  Send, ChevronLeft, ExternalLink, AlertCircle, CheckCircle, Copy, Check,
  Sparkles, FileText, Info, ClipboardList, ShieldAlert,
} from 'lucide-react';

// ── Step indicator ────────────────────────────────────────────────────────────

function Steps({ step }: { step: number }) {
  const steps = ['Overview', 'AI Drafting', 'Review Answers', 'Apply'];
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

// ── Field type badge ──────────────────────────────────────────────────────────

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

// ── Editable field card ───────────────────────────────────────────────────────

function FieldCard({
  field, index, onChange,
}: {
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

  const isEmpty = !field.approved_value?.trim();

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

// ── Copy-all answers panel ───────────────────────────────────────────────────

function CopyPanel({ fields, url }: {
  fields: FormField[];
  url: string;
  company?: string;
  role?: string;
}) {
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

  return (
    <div className="space-y-4">
      <div className="p-4 bg-[var(--color-green-indicator)]/5 border border-[var(--color-green-indicator)]/30 rounded-xl flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-[var(--color-green-indicator)] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[var(--color-green-indicator)]">Answers saved — ready to apply!</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Open the application form and paste each answer. The AI drafted these based on your CV — review before submitting.
          </p>
        </div>
      </div>

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
        <button
          onClick={handleCopyAll}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/40 transition-colors"
        >
          {copiedAll ? <Check className="w-4 h-4 text-[var(--color-green-indicator)]" /> : <Copy className="w-4 h-4" />}
          {copiedAll ? 'COPIED ALL' : 'COPY ALL ANSWERS'}
        </button>
      </div>

      <div className="space-y-3">
        {fields.filter(f => f.approved_value?.trim()).map((f, i) => (
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

      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--color-text-muted)]">
          Career-Ops never submits anything on your behalf. You control the final submission. Always review AI-drafted answers before sending.
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type PageStep = 1 | 2 | 3 | 4;

export default function ApplyPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const appId = parseInt(applicationId || '0', 10);

  const [app, setApp] = useState<Application | null>(null);
  const [appLoading, setAppLoading] = useState(true);
  const [appError, setAppError] = useState('');

  const [step, setStep] = useState<PageStep>(1);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState('');
  const [draft, setDraft] = useState<ApplyPrepareResponse | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Load application
  useEffect(() => {
    if (!appId) { setAppError('Invalid application ID'); setAppLoading(false); return; }
    getApplication(appId)
      .then(a => setApp(a))
      .catch(e => setAppError(e.message || 'Application not found'))
      .finally(() => setAppLoading(false));
  }, [appId]);

  const handleLaunch = useCallback(async () => {
    if (!appId) return;
    setPreparing(true);
    setPrepareError('');
    setStep(2);
    try {
      const result = await prepareApply(appId);
      setDraft(result);
      setFields(result.fields);
      setStep(3);
    } catch (e: unknown) {
      const err = e as Error & { error_type?: string };
      setPrepareError(err.message || 'Preparation failed');
      setStep(1);
    } finally {
      setPreparing(false);
    }
  }, [appId]);

  const handleFieldChange = (index: number, value: string) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, approved_value: value } : f));
  };

  const handleSaveAndProceed = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError('');
    try {
      await fillApply(draft.attempt_id, fields);
      setStep(4);
      setTimeout(() => {
        document.getElementById('copy-panel-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save answers');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading / Error states ─────────────────────────────────────────────────

  if (appLoading) {
    return (
      <Layout>
        <div className="py-24 text-center font-mono text-[var(--color-text-muted)] animate-pulse">Loading…</div>
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
          to={`/results/${appId}`}
          className="inline-flex items-center text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Results
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
                  { icon: FileText, text: 'We fetch the application form and detect its fields', color: 'text-[var(--color-primary)]' },
                  { icon: Sparkles, text: 'Claude drafts answers for each field based on your saved CV and evaluation', color: 'text-[var(--color-primary)]' },
                  { icon: ClipboardList, text: 'You review and edit every answer before anything is sent', color: 'text-[var(--color-primary)]' },
                  { icon: CheckCircle, text: 'You copy-paste the answers into the real form and submit yourself', color: 'text-[var(--color-green-indicator)]' },
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
                You always review the AI-drafted answers and click submit yourself on the employer's site. Career-Ops never acts on your behalf.
              </p>
            </div>

            {!app.url && (
              <div className="p-4 bg-[var(--color-yellow-indicator)]/5 border border-[var(--color-yellow-indicator)]/30 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[var(--color-yellow-indicator)] shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--color-yellow-indicator)]">
                  No application URL is saved for this role. Add a URL on the{' '}
                  <Link to="/pipeline" className="underline">Pipeline page</Link> first.
                </p>
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
          <div className="py-16 text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[var(--color-text)]">Analysing application form…</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                Fetching the form, detecting fields, and drafting answers with Claude.
                <br />This usually takes 10–30 seconds.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3: Review draft ── */}
        {step === 3 && draft && (
          <div className="space-y-5">
            {/* Detection banner */}
            {draft.detection_type === 'fallback' && (
              <div className="p-4 bg-[var(--color-yellow-indicator)]/5 border border-[var(--color-yellow-indicator)]/30 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[var(--color-yellow-indicator)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-yellow-indicator)]">
                    {draft.detection_error === 'AUTH_WALL' ? 'Login required' :
                     draft.detection_error === 'JS_REQUIRED' ? 'JavaScript-rendered form' :
                     draft.detection_error === 'TIMEOUT' ? 'Form page timed out' :
                     'Could not detect form fields'}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Using standard ATS fields instead. Claude has still drafted answers for all common fields.
                    {' '}<a href={draft.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline hover:no-underline">Open the form</a>
                    {' '}to see what's actually required.
                  </p>
                </div>
              </div>
            )}

            {draft.detection_type === 'detected' && (
              <div className="p-4 bg-[var(--color-green-indicator)]/5 border border-[var(--color-green-indicator)]/30 rounded-xl flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-[var(--color-green-indicator)] shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--color-green-indicator)]">
                  {fields.length} form fields detected and pre-filled. Review and edit each answer below.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-lg font-bold font-mono">Review Your Answers</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Claude drafted these based on your CV and evaluation. Edit anything that needs adjusting — you know your story best.
              </p>
            </div>

            <div className="space-y-3">
              {fields.map((f, i) => (
                <FieldCard
                  key={f.name || i}
                  field={f}
                  index={i}
                  onChange={val => handleFieldChange(i, val)}
                />
              ))}
            </div>

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
                {saving ? 'SAVING…' : "I'M HAPPY — SHOW ME HOW TO APPLY"}
              </Button>
              <p className="text-xs text-[var(--color-text-muted)] self-center">
                Saves your approved answers and shows the copy-paste panel.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 4: Apply ── */}
        {step === 4 && draft && (
          <div id="copy-panel-top" className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-lg font-bold font-mono">Apply Now</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Open the application form, paste each answer, and submit when ready.
              </p>
            </div>
            <CopyPanel
              fields={fields}
              url={draft.url}
              company={draft.company}
              role={draft.role}
            />
          </div>
        )}

      </div>
    </Layout>
  );
}
