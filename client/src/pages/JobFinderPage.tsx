import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import {
  findJobs, getJobFinderHistory, getJobFinderRun, getCv, getSavedJobs, saveJob, deleteSavedJob,
} from '../api';
import type { JobFinderRun, JobFinderResult, JobFinderHistoryItem, JobFinderPreferences } from '../api';
import {
  Search, AlertCircle, Clock, FileText, ExternalLink,
  CheckCircle, XCircle, TrendingUp, ChevronRight, RotateCcw, Bookmark, BookmarkCheck,
} from 'lucide-react';

function MatchBadge({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'text-[var(--color-green-indicator)] border-[var(--color-green-indicator)]/30 bg-[var(--color-green-indicator)]/5' :
    pct >= 65 ? 'text-[var(--color-yellow-indicator)] border-[var(--color-yellow-indicator)]/30 bg-[var(--color-yellow-indicator)]/5' :
    'text-[var(--color-text-muted)] border-[var(--color-border)] bg-[var(--color-bg)]';
  return (
    <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border-2 shrink-0 ${color}`}>
      <span className="text-xl font-bold font-mono tabular-nums leading-none">{pct}</span>
      <span className="text-[10px] font-mono opacity-70">%</span>
    </div>
  );
}

function CompRange({ low, high }: { low: number | null; high: number | null }) {
  if (!low && !high) return null;
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`;
  return (
    <span className="text-xs font-mono text-[var(--color-text-muted)]">
      {low && high ? `${fmt(low)}–${fmt(high)}/yr` : low ? `from ${fmt(low)}/yr` : `up to ${fmt(high!)}/yr`}
    </span>
  );
}

function JobCard({
  job,
  onEvaluate,
  savedJobId,
  onSave,
  onUnsave,
}: {
  job: JobFinderResult;
  onEvaluate: (job: JobFinderResult) => void;
  savedJobId?: number;
  onSave: (job: JobFinderResult) => void;
  onUnsave: (savedId: number) => void;
}) {
  const isSaved = savedJobId !== undefined;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4 hover:border-[var(--color-primary)]/30 transition-colors">
      <div className="flex items-start gap-4">
        <MatchBadge pct={job.match_pct} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-[var(--color-text)] leading-tight">{job.role}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-sm font-medium text-[var(--color-primary)]">{job.company}</span>
                <span className="text-[var(--color-border)]">·</span>
                <span className="text-sm text-[var(--color-text-muted)]">{job.location}</span>
                {job.remote_ok && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--color-green-indicator)]/10 text-[var(--color-green-indicator)] border border-[var(--color-green-indicator)]/20">
                    Remote OK
                  </span>
                )}
                <CompRange low={job.comp_low} high={job.comp_high} />
              </div>
            </div>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
              title="View job posting"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed pt-1">{job.description}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 pt-1 border-t border-[var(--color-border)]">
        <div className="space-y-2">
          <div className="text-xs font-mono uppercase text-[var(--color-green-indicator)]">Why You Match</div>
          <ul className="space-y-1">
            {job.why_match.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                <CheckCircle className="w-3.5 h-3.5 text-[var(--color-green-indicator)] shrink-0 mt-0.5" />
                {b}
              </li>
            ))}
          </ul>
        </div>
        {job.skill_gaps.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Skill Gaps</div>
            <ul className="space-y-1">
              {job.skill_gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                  <XCircle className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0 mt-0.5" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors truncate max-w-[200px]"
        >
          {job.url.replace(/^https?:\/\//, '').slice(0, 60)}
        </a>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => isSaved ? onUnsave(savedJobId!) : onSave(job)}
            aria-label={isSaved ? 'Remove from saved' : 'Save job'}
            className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1.5 rounded-lg border transition-colors ${
              isSaved
                ? 'text-[var(--color-primary)] border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20'
                : 'text-[var(--color-text-muted)] border-[var(--color-border)] bg-transparent hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5'
            }`}
          >
            {isSaved
              ? <><BookmarkCheck className="w-3.5 h-3.5" />Saved</>
              : <><Bookmark className="w-3.5 h-3.5" />Save Job</>}
          </button>
          <Button
            variant="outline"
            onClick={() => onEvaluate(job)}
            className="font-mono text-xs gap-1.5"
          >
            Evaluate Fit
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

const WORK_STYLES = [
  { value: '', label: 'Any' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'on-site', label: 'On-site' },
] as const;

export default function JobFinderPage() {
  const navigate = useNavigate();

  const [run, setRun] = useState<JobFinderRun | null>(null);
  const [history, setHistory] = useState<JobFinderHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [noCV, setNoCV] = useState(false);
  const [cvText, setCvText] = useState('');
  // savedMap: key = "role|||company|||url", value = saved_job id
  const [savedMap, setSavedMap] = useState<Map<string, number>>(new Map());

  const [prefs, setPrefs] = useState<JobFinderPreferences>({
    location: '',
    work_style: '',
    salary_min: '',
    salary_max: '',
    focus_area: '',
  });

  function jobKey(job: { role: string; company: string; url: string }) {
    return `${job.role}|||${job.company}|||${job.url}`;
  }

  useEffect(() => {
    Promise.all([
      getJobFinderHistory().then(d => setHistory(d.history)).catch(() => {}),
      getCv().then(cv => {
        if (!cv.content_md || cv.content_md.trim().length < 50) {
          setNoCV(true);
        } else {
          setCvText(cv.content_md);
        }
      }).catch(() => setNoCV(true)),
      getSavedJobs().then(d => {
        const map = new Map<string, number>();
        for (const sj of d.saved_jobs) {
          map.set(jobKey(sj as { role: string; company: string; url: string }), sj.id);
        }
        setSavedMap(map);
      }).catch(() => {}),
    ]).finally(() => setHistoryLoading(false));
  }, []);

  const setPref = <K extends keyof JobFinderPreferences>(key: K, val: JobFinderPreferences[K]) => {
    setPrefs(p => ({ ...p, [key]: val }));
  };

  const handleSearch = async () => {
    const cvToSend = cvText.trim();
    if (cvToSend.length < 50) {
      setError('Please paste your resume before searching.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await findJobs({ preferences: prefs, cv_content: cvToSend });
      setRun(result);
      setNoCV(false);
      const newEntry: JobFinderHistoryItem = {
        id: result.id,
        top_role: result.results[0]?.role ?? null,
        top_pct: result.results[0]?.match_pct ?? null,
        result_count: result.results.length,
        preferences: result.preferences,
        created_at: result.created_at,
      };
      setHistory(prev => [newEntry, ...prev.filter(h => h.id !== result.id)]);
      setTimeout(() => {
        document.getElementById('job-finder-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadHistory = async (id: number) => {
    setLoading(true);
    setError('');
    try {
      const r = await getJobFinderRun(id);
      setRun(r);
      setTimeout(() => {
        document.getElementById('job-finder-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load result.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (job: JobFinderResult) => {
    try {
      const saved = await saveJob({
        job_finder_run_id: run?.id ?? null,
        role: job.role,
        company: job.company,
        url: job.url,
        match_pct: job.match_pct,
      });
      setSavedMap(prev => new Map(prev).set(jobKey(job), saved.id));
    } catch (e) {
      console.error('Failed to save job:', e);
    }
  };

  const handleUnsave = async (savedId: number, job: JobFinderResult) => {
    try {
      await deleteSavedJob(savedId);
      setSavedMap(prev => {
        const next = new Map(prev);
        next.delete(jobKey(job));
        return next;
      });
    } catch (e) {
      console.error('Failed to unsave job:', e);
    }
  };

  const handleEvaluate = (job: JobFinderResult) => {
    const jobTitle = `${job.role} at ${job.company}`;
    const header = [
      jobTitle,
      `Location: ${job.location}${job.remote_ok ? ' (Remote OK)' : ''}`,
      job.comp_low || job.comp_high
        ? `Compensation: $${job.comp_low ? Math.round(job.comp_low / 1000) : '?'}K–$${job.comp_high ? Math.round(job.comp_high / 1000) : '?'}K/year`
        : '',
    ].filter(Boolean).join('\n');

    // Always prepend title/meta header; use full posting text body when available
    const body = job.full_text && job.full_text.trim().length > 200
      ? job.full_text.trim()
      : [
          job.description,
          '',
          'Why you match:',
          ...job.why_match.map(b => `• ${b}`),
          '',
          job.skill_gaps.length ? 'Skill gaps:' : '',
          ...job.skill_gaps.map(g => `• ${g}`),
        ].filter(l => l !== undefined).join('\n').trim();

    const jobDescription = `${header}\n\n${body}`;

    navigate('/evaluate', {
      state: { jobTitle, jobDescription, jobUrl: job.url },
    });
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Search className="w-7 h-7 text-[var(--color-primary)]" />
            <h1 className="text-3xl font-bold font-mono tracking-tight">Job Finder</h1>
          </div>
          <p className="text-[var(--color-text-muted)] max-w-2xl">
            Searches Greenhouse, Lever, Wellfound, and other job boards for real, current openings — then uses AI to score each one against your resume and rank them by fit.
          </p>
        </div>

        {/* CV input */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-sm font-bold font-mono uppercase text-[var(--color-text)]">Your Resume</span>
            {!noCV && cvText && (
              <span className="text-xs font-mono text-[var(--color-green-indicator)] ml-1">· saved CV loaded</span>
            )}
            {noCV && (
              <span className="flex items-center gap-1 text-xs font-mono text-[var(--color-accent)] ml-1">
                <AlertCircle className="w-3 h-3" /> no saved CV
              </span>
            )}
          </div>
          <textarea
            value={cvText}
            onChange={e => setCvText(e.target.value)}
            placeholder="Paste your full resume here (plain text or markdown)…"
            rows={noCV ? 10 : 5}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-sm font-mono text-[var(--color-text)] placeholder-[var(--color-text-muted)] resize-y focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
          />
        </div>

        {/* Preferences */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-sm font-bold font-mono uppercase text-[var(--color-text)]">Search Preferences</span>
            <span className="text-xs text-[var(--color-text-muted)] font-mono ml-1">· all optional</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Location</label>
              <input
                type="text"
                value={prefs.location}
                onChange={e => setPref('location', e.target.value)}
                placeholder="e.g. New York, London, anywhere"
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Work Style</label>
              <div className="flex gap-2">
                {WORK_STYLES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setPref('work_style', s.value as JobFinderPreferences['work_style'])}
                    className={`flex-1 py-2 text-xs font-mono rounded-lg border transition-colors ${
                      prefs.work_style === s.value
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Target Salary (USD thousands/year)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={prefs.salary_min}
                  onChange={e => setPref('salary_min', e.target.value ? Number(e.target.value) : '')}
                  placeholder="Min e.g. 80"
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
                />
                <span className="text-[var(--color-text-muted)] shrink-0">–</span>
                <input
                  type="number"
                  value={prefs.salary_max}
                  onChange={e => setPref('salary_max', e.target.value ? Number(e.target.value) : '')}
                  placeholder="Max e.g. 150"
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Focus Area</label>
              <input
                type="text"
                value={prefs.focus_area}
                onChange={e => setPref('focus_area', e.target.value)}
                placeholder="e.g. Product Management, AI, EdTech"
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-[var(--color-red-indicator)]/5 border border-[var(--color-red-indicator)]/30 rounded-xl flex items-start gap-3 text-sm text-[var(--color-red-indicator)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Search button */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Button
            onClick={handleSearch}
            disabled={loading}
            variant="primary"
            className="gap-2 font-mono"
          >
            <Search className="w-4 h-4" />
            {loading ? 'SEARCHING & SCORING JOBS...' : run ? 'SEARCH AGAIN' : 'FIND JOBS'}
          </Button>
          {run && (
            <button
              onClick={handleSearch}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Re-run with current settings
            </button>
          )}
        </div>

        {/* History */}
        {!historyLoading && history.length > 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
            <h2 className="text-xs font-bold font-mono uppercase text-[var(--color-text-muted)]">Past Searches</h2>
            <div className="flex flex-col gap-1">
              {history.map(h => (
                <button
                  key={h.id}
                  onClick={() => handleLoadHistory(h.id)}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors text-left ${run?.id === h.id ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20' : ''}`}
                >
                  <span className="flex items-center gap-2 text-[var(--color-text)]">
                    <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                    <span className="font-medium">{h.top_role ?? 'Job Search'}</span>
                    {h.top_pct != null && (
                      <span className="text-xs text-[var(--color-text-muted)]">· top {h.top_pct}%</span>
                    )}
                    <span className="text-xs text-[var(--color-text-muted)]">· {h.result_count} jobs</span>
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] font-mono shrink-0 ml-4">
                    {new Date(h.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-16 text-center space-y-3">
            <Search className="w-8 h-8 text-[var(--color-primary)] mx-auto animate-pulse" />
            <p className="font-mono text-[var(--color-text-muted)] animate-pulse">Searching job boards and scoring matches…</p>
            <p className="text-xs text-[var(--color-text-muted)]">This usually takes 20–40 seconds</p>
          </div>
        )}

        {/* Results */}
        {run && !loading && (
          <div id="job-finder-results" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-mono uppercase text-[var(--color-primary)]">
                {run.results.length} Jobs Found
              </h2>
              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                Sorted by match score
              </span>
            </div>

            <div className="space-y-4">
              {run.results.map((job, i) => {
                const key = jobKey(job);
                const savedId = savedMap.get(key);
                return (
                  <JobCard
                    key={i}
                    job={job}
                    onEvaluate={handleEvaluate}
                    savedJobId={savedId}
                    onSave={handleSave}
                    onUnsave={(sid) => handleUnsave(sid, job)}
                  />
                );
              })}
            </div>

            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text-muted)] font-mono">
              Jobs sourced from Greenhouse, Lever, Wellfound and other boards via Exa · Scored against your resume by AI · Click "Evaluate Fit" to run a full analysis and add to your pipeline
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
