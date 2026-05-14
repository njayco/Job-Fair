import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { getEmployerPipeline, updateCandidateStatus } from '../api';
import type { PipelineCandidate } from '../api';
import { Loader2, User, Building2, Award, X } from 'lucide-react';

const PIPELINE_COLS: { status: string; label: string; color: string }[] = [
  { status: 'Uploaded',     label: 'Uploaded',     color: 'text-zinc-400 border-zinc-500/20 bg-zinc-500/5' },
  { status: 'Evaluated',   label: 'Evaluated',    color: 'text-blue-400 border-blue-500/20 bg-blue-500/5' },
  { status: 'Interviewing',label: 'Interviewing', color: 'text-purple-400 border-purple-500/20 bg-purple-500/5' },
  { status: 'Final Round', label: 'Final Round',  color: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5' },
  { status: 'Offer Sent',  label: 'Offer Sent',   color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5' },
  { status: 'Hired',       label: 'Hired',        color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' },
  { status: 'Rejected',    label: 'Rejected',     color: 'text-red-400 border-red-500/20 bg-red-500/5' },
];

const ALL_STATUSES = [...PIPELINE_COLS.map(c => c.status), 'Offer'];

const SENIORITY_OPTIONS = ['junior', 'mid', 'senior', 'principal'];
const REC_OPTIONS = ['Strong Hire', 'Hire', 'Consider', 'Weak Match', 'Do Not Proceed'];

const SCORE_COLOR = (s: number | null) => {
  if (s === null) return 'text-[var(--color-text-muted)]';
  if (s >= 75) return 'text-emerald-400';
  if (s >= 55) return 'text-yellow-400';
  return 'text-red-400';
};

function CandidateCard({ c, onStatusChange }: {
  c: PipelineCandidate;
  onStatusChange: (id: number, jobId: number, status: string) => void;
}) {
  const [updating, setUpdating] = useState(false);

  const handleStatus = async (status: string) => {
    setUpdating(true);
    try {
      await updateCandidateStatus(c.job_id, c.id, status);
      onStatusChange(c.id, c.job_id, status);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 space-y-2.5 hover:border-[var(--color-accent)]/30 transition-colors">
      <Link to={`/employer/jobs/${c.job_id}/candidates/${c.id}`} className="block space-y-1 group">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate group-hover:text-[var(--color-accent)] transition-colors">
              {c.parsed_name || <span className="text-[var(--color-text-muted)] italic text-xs">{c.filename}</span>}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] font-mono truncate">{c.job_title}</p>
          </div>
          {c.match_score !== null && (
            <span className={`text-sm font-bold font-mono shrink-0 ${SCORE_COLOR(c.match_score)}`}>
              {c.match_score}
            </span>
          )}
        </div>
        {c.parsed_employer && (
          <p className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{c.parsed_employer}</span>
          </p>
        )}
        {c.recommendation && (
          <p className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <Award className="w-3 h-3 shrink-0" />
            {c.recommendation}
          </p>
        )}
      </Link>

      <div onClick={e => e.preventDefault()} className="flex items-center gap-1">
        <select
          value={c.status}
          disabled={updating}
          onChange={e => handleStatus(e.target.value)}
          className="text-[10px] font-mono bg-transparent border border-[var(--color-border)] rounded px-1.5 py-0.5 cursor-pointer flex-1 text-[var(--color-text-muted)]"
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {updating && <Loader2 className="w-3 h-3 animate-spin text-[var(--color-text-muted)] shrink-0" />}
      </div>
    </div>
  );
}

export default function EmployerPipelinePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<PipelineCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  // Client-side filters
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [filterSeniority, setFilterSeniority] = useState<string[]>([]);
  const [filterRec, setFilterRec] = useState<string[]>([]);
  const [filterEmployer, setFilterEmployer] = useState('');

  useEffect(() => {
    if (user && user.account_type !== 'employer') navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    getEmployerPipeline()
      .then(data => setCandidates(data.candidates))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = (id: number, jobId: number, status: string) => {
    setCandidates(prev => prev.map(c => c.id === id && c.job_id === jobId ? { ...c, status } : c));
  };

  const totalActive = candidates.filter(c => !['Hired', 'Rejected'].includes(c.status)).length;
  const totalHired = candidates.filter(c => c.status === 'Hired').length;

  const hasFilters = filterMinScore > 0 || filterSeniority.length > 0 || filterRec.length > 0 || filterEmployer.trim();

  const applyFilters = (list: PipelineCandidate[]) => list.filter(c => {
    if (filterMinScore > 0 && (c.match_score ?? 0) < filterMinScore) return false;
    if (filterSeniority.length && !filterSeniority.includes(c.seniority ?? '')) return false;
    if (filterRec.length && !filterRec.includes(c.recommendation ?? '')) return false;
    if (filterEmployer.trim() && !c.parsed_employer?.toLowerCase().includes(filterEmployer.toLowerCase())) return false;
    return true;
  });

  const tabFiltered = activeTab === 'all' ? candidates : candidates.filter(c => c.status === activeTab);
  const filtered = applyFilters(tabFiltered);

  const tabCounts = Object.fromEntries(
    PIPELINE_COLS.map(col => [col.status, applyFilters(candidates.filter(c => c.status === col.status)).length])
  );
  const allCount = applyFilters(candidates).length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-mono">Candidate Pipeline</h1>
          {!loading && !error && (
            <p className="text-sm text-[var(--color-text-muted)]">
              {candidates.length} total · {totalActive} active · {totalHired} hired
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
          </div>
        ) : error ? (
          <div className="py-16 text-center text-[var(--color-red-indicator)]">{error}</div>
        ) : candidates.length === 0 ? (
          <div className="py-20 text-center space-y-4 border border-dashed border-[var(--color-border)] rounded-xl">
            <User className="w-10 h-10 text-[var(--color-text-muted)] mx-auto" />
            <p className="text-[var(--color-text-muted)]">No candidates yet.</p>
            <Link
              to="/employer/search"
              className="inline-flex items-center gap-2 text-sm font-mono px-4 py-2 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
            >
              Start a candidate search
            </Link>
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] flex items-center justify-between">
                    Min Score
                    <span className="text-[var(--color-accent)]">{filterMinScore > 0 ? filterMinScore : 'Any'}</span>
                  </label>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={filterMinScore}
                    onChange={e => setFilterMinScore(Number(e.target.value))}
                    className="w-full accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Current Employer</label>
                  <input
                    type="text"
                    value={filterEmployer}
                    onChange={e => setFilterEmployer(e.target.value)}
                    placeholder="Search employer…"
                    className="w-full font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Seniority</label>
                  <div className="flex flex-wrap gap-1">
                    {SENIORITY_OPTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => setFilterSeniority(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors capitalize ${
                          filterSeniority.includes(s)
                            ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/50 text-[var(--color-accent)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/30'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Recommendation</label>
                  <div className="flex flex-wrap gap-1">
                    {REC_OPTIONS.map(r => (
                      <button
                        key={r}
                        onClick={() => setFilterRec(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                          filterRec.includes(r)
                            ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/50 text-[var(--color-accent)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/30'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {hasFilters && (
                <div className="flex items-center justify-between text-xs font-mono text-[var(--color-text-muted)]">
                  <span>{allCount} of {candidates.length} candidates match filters</span>
                  <button
                    onClick={() => { setFilterMinScore(0); setFilterSeniority([]); setFilterRec([]); setFilterEmployer(''); }}
                    className="flex items-center gap-1 text-[var(--color-red-indicator)] hover:underline"
                  >
                    <X className="w-3 h-3" /> Clear filters
                  </button>
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[var(--color-border)]">
              <button
                onClick={() => setActiveTab('all')}
                className={`shrink-0 px-3 py-2 text-xs font-mono rounded-t transition-colors ${
                  activeTab === 'all'
                    ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                All ({allCount})
              </button>
              {PIPELINE_COLS.map(col => (
                <button
                  key={col.status}
                  onClick={() => setActiveTab(col.status)}
                  className={`shrink-0 px-3 py-2 text-xs font-mono rounded-t transition-colors ${
                    activeTab === col.status
                      ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {col.label} ({tabCounts[col.status] ?? 0})
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-[var(--color-text-muted)] text-sm border border-dashed border-[var(--color-border)] rounded-xl">
                {hasFilters ? 'No candidates match your filters in this stage.' : 'No candidates in this stage.'}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map(c => (
                  <CandidateCard key={`${c.job_id}-${c.id}`} c={c} onStatusChange={handleStatusChange} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
