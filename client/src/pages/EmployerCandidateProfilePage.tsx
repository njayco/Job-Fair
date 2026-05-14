import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import {
  ArrowLeft, Mail, Phone, Building2, Award, CheckCircle2,
  XCircle, Loader2, Sparkles, ChevronDown, ChevronUp, User,
  Target, BarChart2, DollarSign, UserSearch, MessageSquare, Download,
} from 'lucide-react';
import {
  getEmployerCandidate, generateInterviewQuestions, updateCandidateStatus,
} from '../api';
import type { EmployerCandidateFull, EmployerJob, InterviewQuestion, SkillMatchItem } from '../api';
import { Button } from '../components/ui/button';

const SCORE_COLOR = (s: number | null) => {
  if (s === null) return 'text-[var(--color-text-muted)]';
  if (s >= 75) return 'text-emerald-400';
  if (s >= 55) return 'text-yellow-400';
  return 'text-red-400';
};

const SCORE_RING_COLOR = (s: number | null) => {
  if (s === null) return '#6b7280';
  if (s >= 75) return '#34d399';
  if (s >= 55) return '#facc15';
  return '#f87171';
};

const REC_COLORS: Record<string, string> = {
  'Strong Hire': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Hire': 'bg-green-500/15 text-green-400 border-green-500/30',
  'Consider': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'Weak Match': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'Do Not Proceed': 'bg-red-500/15 text-red-400 border-red-500/30',
};

const CANDIDATE_STATUSES = ['Uploaded', 'Evaluated', 'Interviewing', 'Final Round', 'Offer Sent', 'Offer', 'Hired', 'Rejected'];

function ScoreRing({ score }: { score: number | null }) {
  const pct = score ?? 0;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} stroke="#ffffff10" strokeWidth="8" fill="none" />
        <circle
          cx="50" cy="50" r={r}
          stroke={SCORE_RING_COLOR(score)} strokeWidth="8" fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold font-mono ${SCORE_COLOR(score)}`}>{score ?? '—'}</span>
        <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase">fit</span>
      </div>
    </div>
  );
}

function Section({ icon: Icon, label, tag, children }: {
  icon: React.ElementType;
  label: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded border border-[var(--color-accent)]/20">
          {tag}
        </span>
        <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{label}</h2>
      </div>
      {children}
    </div>
  );
}

function QuestionItem({ q, idx }: { q: InterviewQuestion; idx: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface)]/50 transition-colors"
      >
        <span className="font-mono text-xs text-[var(--color-accent)] shrink-0 mt-0.5 w-5">Q{idx + 1}</span>
        <span className="text-sm flex-1">{q.question}</span>
        {open
          ? <ChevronUp className="w-4 h-4 shrink-0 text-[var(--color-text-muted)] mt-0.5" />
          : <ChevronDown className="w-4 h-4 shrink-0 text-[var(--color-text-muted)] mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0">
          <div className="ml-8 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)]/60 rounded p-3 border-l-2 border-[var(--color-accent)]/40">
            <span className="font-mono text-[var(--color-accent)]/70 uppercase text-[10px]">Rationale — </span>
            {q.rationale}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillRow({ item }: { item: SkillMatchItem }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[var(--color-border)] last:border-0">
      {item.met
        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.requirement}</p>
        {item.note && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.note}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
          item.met
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
          {item.met ? '✓ Met' : '✗ Gap'}
        </span>
        {item.severity && (
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
            item.severity === 'must_have'
              ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
          }`}>
            {item.severity === 'must_have' ? 'must-have' : 'nice-to-have'}
          </span>
        )}
      </div>
    </div>
  );
}

export default function EmployerCandidateProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: jobId, candidateId } = useParams<{ id?: string; candidateId?: string }>();

  const [candidate, setCandidate] = useState<EmployerCandidateFull | null>(null);
  const [job, setJob] = useState<EmployerJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [generatingQs, setGeneratingQs] = useState(false);
  const [qError, setQError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (user && user.account_type !== 'employer') navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!jobId || !candidateId) return;
    setLoading(true);
    getEmployerCandidate(Number(jobId), Number(candidateId))
      .then(data => { setCandidate(data.candidate); setJob(data.job); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [jobId, candidateId]);

  const handleGenerateQuestions = async () => {
    if (!jobId || !candidateId) return;
    setGeneratingQs(true);
    setQError('');
    try {
      const result = await generateInterviewQuestions(Number(jobId), Number(candidateId));
      setCandidate(prev => prev ? {
        ...prev,
        evaluation_json: {
          ...(prev.evaluation_json || {}),
          interview_questions: result.questions,
        } as typeof prev.evaluation_json,
      } : prev);
    } catch (err) {
      setQError(err instanceof Error ? err.message : 'Failed to generate questions.');
    } finally {
      setGeneratingQs(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!jobId || !candidateId || !candidate) return;
    setUpdatingStatus(true);
    try {
      await updateCandidateStatus(Number(jobId), Number(candidateId), status);
      setCandidate(prev => prev ? { ...prev, status } : prev);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!jobId || !candidateId || downloadingResume) return;
    setDownloadingResume(true);
    setDownloadError('');
    try {
      const res = await fetch(`/api/employer/jobs/${jobId}/candidates/${candidateId}/resume`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Resume not available.');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const nameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
      const downloadName = nameMatch
        ? decodeURIComponent(nameMatch[1].trim())
        : (candidate?.filename || 'resume');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingResume(false);
    }
  };

  const evalJson = candidate?.evaluation_json;
  const questions = evalJson?.interview_questions;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        </div>
      </Layout>
    );
  }

  if (error || !candidate) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
          <p className="text-[var(--color-red-indicator)]">{error || 'Candidate not found.'}</p>
          <Link to={jobId ? `/employer/jobs/${jobId}` : '/employer'}
            className="text-sm font-mono text-[var(--color-accent)] hover:underline">
            ← Back to results
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm font-mono text-[var(--color-text-muted)]">
          <Link to="/employer" className="hover:text-[var(--color-text)] transition-colors">Dashboard</Link>
          <span>/</span>
          {job && (
            <>
              <Link to={`/employer/jobs/${jobId}`} className="hover:text-[var(--color-text)] transition-colors truncate max-w-[200px]">
                {job.title}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-[var(--color-text)] truncate max-w-[200px]">
            {candidate.parsed_name || candidate.filename}
          </span>
        </div>

        {/* Header card */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <ScoreRing score={candidate.match_score} />

            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                <div>
                  <h1 className="text-2xl font-bold font-mono">
                    {candidate.parsed_name || <span className="text-[var(--color-text-muted)]">{candidate.filename}</span>}
                  </h1>
                  {candidate.parsed_employer && (
                    <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-1 mt-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {candidate.parsed_employer}
                    </p>
                  )}
                </div>
                {evalJson?.recommendation && (
                  <span className={`inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-full border ${REC_COLORS[evalJson.recommendation] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <Award className="w-3 h-3" />
                    {evalJson.recommendation}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-muted)]">
                {candidate.parsed_email && (
                  <a href={`mailto:${candidate.parsed_email}`} className="flex items-center gap-1.5 hover:text-[var(--color-accent)] transition-colors">
                    <Mail className="w-3.5 h-3.5" />
                    {candidate.parsed_email}
                  </a>
                )}
                {candidate.parsed_phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {candidate.parsed_phone}
                  </span>
                )}
                {!candidate.parsed_email && !candidate.parsed_phone && (
                  <span className="flex items-center gap-1.5 text-xs">
                    <User className="w-3.5 h-3.5" />
                    No contact info extracted
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Status:</span>
                <select
                  value={candidate.status}
                  disabled={updatingStatus}
                  onChange={e => handleStatusChange(e.target.value)}
                  className="text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 cursor-pointer"
                >
                  {CANDIDATE_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {updatingStatus && <Loader2 className="w-3 h-3 animate-spin text-[var(--color-text-muted)]" />}
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <Link
                to={`/employer/jobs/${jobId}`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors border border-[var(--color-border)] px-3 py-1.5 rounded"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Results
              </Link>
              <button
                onClick={handleDownloadResume}
                disabled={downloadingResume}
                title={downloadError || undefined}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors border border-[var(--color-accent)]/30 hover:border-[var(--color-accent)]/60 px-3 py-1.5 rounded bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingResume
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />}
                {downloadingResume ? 'Downloading…' : 'Download'}
              </button>
              {downloadError && (
                <p className="text-[10px] font-mono text-[var(--color-red-indicator)] max-w-[120px] leading-tight">{downloadError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        {evalJson?.summary && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Executive Summary</p>
            <p className="text-sm leading-relaxed">{evalJson.summary}</p>
          </div>
        )}

        {/* A — Role Alignment */}
        {evalJson?.role_alignment ? (
          <Section icon={Target} label="Role Alignment" tag="A">
            <p className="text-sm leading-relaxed whitespace-pre-line">{evalJson.role_alignment}</p>
          </Section>
        ) : evalJson && !evalJson.role_alignment ? (
          <Section icon={Target} label="Role Alignment" tag="A">
            <div className="space-y-2">
              {evalJson.strengths?.length ? (
                <ul className="space-y-1.5">
                  {evalJson.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              ) : null}
              {!evalJson.strengths?.length && <p className="text-sm text-[var(--color-text-muted)] italic">Re-evaluate this candidate to generate full role alignment analysis.</p>}
            </div>
          </Section>
        ) : null}

        {/* B — Skill Match */}
        {evalJson?.skill_match?.length ? (
          <Section icon={BarChart2} label="Skill Match" tag="B">
            <div className="divide-y divide-[var(--color-border)]">
              {evalJson.skill_match.map((item, i) => (
                <SkillRow key={i} item={item} />
              ))}
            </div>
          </Section>
        ) : evalJson?.gaps?.length ? (
          <Section icon={BarChart2} label="Skill Match" tag="B">
            <div className="space-y-2">
              {evalJson.strengths?.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  {s}
                </div>
              ))}
              {evalJson.gaps?.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  {g}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {/* C — Seniority Evaluation */}
        {(evalJson?.seniority || evalJson?.seniority_rationale) ? (
          <Section icon={UserSearch} label="Seniority Evaluation" tag="C">
            <div className="space-y-2">
              {evalJson.seniority && (
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold font-mono capitalize">{evalJson.seniority}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 capitalize">
                    {evalJson.seniority} level
                  </span>
                </div>
              )}
              {evalJson.seniority_rationale && (
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{evalJson.seniority_rationale}</p>
              )}
            </div>
          </Section>
        ) : null}

        {/* D — Compensation Intelligence */}
        {(evalJson?.comp_low || evalJson?.comp_high || evalJson?.comp_context) ? (
          <Section icon={DollarSign} label="Compensation Intelligence" tag="D">
            <div className="space-y-3">
              {(evalJson.comp_low || evalJson.comp_high) && (
                <div>
                  <p className="text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1">Estimated Range</p>
                  <p className="text-2xl font-bold font-mono">
                    {evalJson.comp_low ? `$${(evalJson.comp_low / 1000).toFixed(0)}k` : '—'}
                    {evalJson.comp_low && evalJson.comp_high ? ' – ' : ''}
                    {evalJson.comp_high ? `$${(evalJson.comp_high / 1000).toFixed(0)}k` : ''}
                    <span className="text-xs font-normal text-[var(--color-text-muted)] ml-1">/ yr USD</span>
                  </p>
                </div>
              )}
              {evalJson.comp_context && (
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{evalJson.comp_context}</p>
              )}
            </div>
          </Section>
        ) : null}

        {/* E — Resume & Profile Analysis */}
        {evalJson?.profile_analysis ? (
          <Section icon={Award} label="Resume & Profile Analysis" tag="E">
            <p className="text-sm leading-relaxed">{evalJson.profile_analysis}</p>
          </Section>
        ) : null}

        {/* Strengths & Gaps — always visible when present */}
        {((evalJson?.strengths?.length ?? 0) > 0 || (evalJson?.gaps?.length ?? 0) > 0) && (
          <div className="grid sm:grid-cols-2 gap-4">
            {(evalJson?.strengths?.length ?? 0) > 0 && (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-3">
                <p className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">Strengths</p>
                <ul className="space-y-2">
                  {evalJson!.strengths!.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(evalJson?.gaps?.length ?? 0) > 0 && (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-3">
                <p className="text-xs font-mono font-bold uppercase tracking-widest text-red-400">Gaps</p>
                <ul className="space-y-2">
                  {evalJson!.gaps!.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* F — Interview Strategy */}
        {(evalJson?.interview_strategy?.focus_areas?.length || evalJson?.interview_strategy?.red_flags?.length) ? (
          <Section icon={MessageSquare} label="Interview Strategy" tag="F">
            <div className="grid sm:grid-cols-2 gap-6">
              {evalJson.interview_strategy?.focus_areas?.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Focus Areas</p>
                  <ul className="space-y-2">
                    {evalJson.interview_strategy.focus_areas.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="font-mono text-[var(--color-accent)] text-xs mt-0.5 shrink-0">→</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {evalJson.interview_strategy?.red_flags?.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Red Flags to Probe</p>
                  <ul className="space-y-2">
                    {evalJson.interview_strategy.red_flags.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="font-mono text-[var(--color-red-indicator)] text-xs mt-0.5 shrink-0">⚑</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}

        {/* Interview Questions */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded border border-[var(--color-accent)]/20">IQ</span>
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Interview Questions</h2>
            </div>
            {questions?.length ? (
              <button
                onClick={handleGenerateQuestions}
                disabled={generatingQs}
                className="text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors flex items-center gap-1"
              >
                {generatingQs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Regenerate
              </button>
            ) : null}
          </div>

          {questions?.length ? (
            <div className="space-y-2">
              {questions.map((q, i) => (
                <QuestionItem key={i} q={q} idx={i} />
              ))}
              {qError && <p className="text-sm text-[var(--color-red-indicator)] pt-1">{qError}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                Generate 10 personalised interview questions tailored to this candidate's background and gaps.
              </p>
              {qError && <p className="text-sm text-[var(--color-red-indicator)]">{qError}</p>}
              <Button
                variant="primary"
                onClick={handleGenerateQuestions}
                disabled={generatingQs}
                className="gap-2 font-mono"
              >
                {generatingQs
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-4 h-4" /> Generate Interview Questions</>}
              </Button>
            </div>
          )}
        </div>

        {/* Resume Text */}
        {candidate.resume_text && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <button
              onClick={() => setResumeOpen(o => !o)}
              className="w-full flex items-center gap-2 px-6 py-4 text-left hover:bg-[var(--color-surface)]/50 transition-colors"
            >
              <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded border border-[var(--color-accent)]/20">
                RAW
              </span>
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex-1">
                Resume Text
              </h2>
              {resumeOpen
                ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />}
            </button>
            {resumeOpen && (
              <div className="px-6 pb-6">
                <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap text-[var(--color-text-muted)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  {candidate.resume_text}
                </pre>
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
