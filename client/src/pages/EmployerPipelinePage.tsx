import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { getEmployerPipeline, getEmployerJobs, updateCandidateStatus } from '../api';
import type { PipelineCandidate, EmployerJob } from '../api';
import { Loader2, User, Building2, Award, X, Search, ChevronDown } from 'lucide-react';

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
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  // New filters
  const [nameSearch, setNameSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('');

  // Existing filters
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [filterSeniority, setFilterSeniority] = useState<string[]>([]);
  const [filterRec, setFilterRec] = useState<string[]>([]);
  const [filterEmployer, setFilterEmployer] = useState('');

  useEffect(() => {
    if (user && user.account_type !== 'employer') navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    Promise.all([getEmployerPipeline(), getEmployerJobs()])
      .then(([pipeline, jobsData]) => {
        setCandidates(pipeline.candidates);
        setJobs(jobsData.jobs);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = (id: number, jobId: number, status: string) => {
    setCandidates(prev => prev.map(c => c.id === id && c.job_id === jobId ? { ...c, status } : c));
  };

  const departments = useMemo(() => {
    const seen = new Set<string>();
    jobs.forEach(j => seen.add(j.department || 'Uncategorised'));
    return Array.from(seen).sort((a, b) => {
      if (a === 'Uncategorised') return 1;
      if (b === 'Uncategorised') return -1;
      return a.localeCompare(b);
    });
  }, [jobs]);

  const jobTitlesInDept = useMemo(() => {
    if (!filterDept) return [];
    return jobs
      .filter(j => (j.department || 'Uncategorised') === filterDept)
      .map(j => j.title)
      .sort();
  }, [jobs, filterDept]);

  const totalActive = candidates.filter(c => !['Hired', 'Rejected'].includes(c.status)).length;
  const totalHired = candidates.filter(c => c.status === 'Hired').length;

  const hasFilters = !!(nameSearch.trim() || filterDept || filterJobTitle ||
    filterMinScore > 0 || filterSeniority.length > 0 || filterRec.length > 0 || filterEmployer.trim());

  const applyFilters = (list: PipelineCandidate[]) => list.filter(c => {
    if (nameSearch.trim()) {
      const q = nameSearch.toLowerCase();
      const name = (c.parsed_name || c.filename || '').toLowerCase();
      if (!name.includes(q)) return false;
    }
    if (filterDept) {
      const dept = c.job_department || 'Uncategorised';
      if (dept !== filterDept) return false;
    }
    if (filterJobTitle && c.job_title !== filterJobTitle) return false;
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

  const grouped = useMemo(() => {
    const deptMap = new Map<string, Map<string, PipelineCandidate[]>>();
    filtered.forEach(c => {
      const dept = c.job_department || 'Uncategorised';
      if (!deptMap.has(dept)) deptMap.set(dept, new Map());
      const titleMap = deptMap.get(dept)!;
      if (!titleMap.has(c.job_title)) titleMap.set(c.job_title, []);
      titleMap.get(c.job_title)!.push(c);
    });
    const sorted = Array.from(deptMap.entries()).sort(([a], [b]) => {
      if (a === 'Uncategorised') return 1;
      if (b === 'Uncategorised') return -1;
      return a.localeCompare(b);
    });
    return sorted.map(([dept, titleMap]) => ({
      dept,
      titles: Array.from(titleMap.entries()).sort(([a], [b]) => a.localeCompare(b)),
    }));
  }, [filtered]);

  const clearAllFilters = () => {
    setNameSearch('');
    setFilterDept('');
    setFilterJobTitle('');
    setFilterMinScore(0);
    setFilterSeniority([]);
    setFilterRec([]);
    setFilterEmployer('');
  };

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
            {/* Name search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
              <input
                type="text"
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
                placeholder="Search candidate by name…"
                className="w-full pl-9 font-mono text-sm"
              />
              {nameSearch && (
                <button
                  onClick={() => setNameSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Department / Job Title dropdowns */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Department</label>
                <div className="relative">
                  <select
                    value={filterDept}
                    onChange={e => { setFilterDept(e.target.value); setFilterJobTitle(''); }}
                    className="w-full font-mono text-sm appearance-none pr-8 cursor-pointer bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2"
                  >
                    <option value="">All departments</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Job Title</label>
                <div className="relative">
                  <select
                    value={filterJobTitle}
                    onChange={e => setFilterJobTitle(e.target.value)}
                    disabled={!filterDept}
                    className="w-full font-mono text-sm appearance-none pr-8 cursor-pointer bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">{filterDept ? 'All titles in department' : 'Select a department first'}</option>
                    {jobTitlesInDept.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
                </div>
              </div>
            </div>

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
                    onClick={clearAllFilters}
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
              <div className="space-y-8">
                {grouped.map(({ dept, titles }) => (
                  <div key={dept} className="space-y-5">
                    {/* Department heading */}
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-[var(--color-accent)]">
                        {dept}
                      </h2>
                      <div className="flex-1 h-px bg-[var(--color-border)]" />
                      <span className="text-xs font-mono text-[var(--color-text-muted)]">
                        {titles.reduce((n, [, cs]) => n + cs.length, 0)} candidate{titles.reduce((n, [, cs]) => n + cs.length, 0) !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Job title groups within department */}
                    {titles.map(([title, cs]) => (
                      <div key={title} className="space-y-3 pl-4 border-l-2 border-[var(--color-border)]">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-mono font-semibold text-[var(--color-text-muted)] uppercase">
                            {title}
                          </h3>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-border)]/40 text-[var(--color-text-muted)]">
                            {cs.length}
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {cs.map(c => (
                            <CandidateCard key={`${c.job_id}-${c.id}`} c={c} onStatusChange={handleStatusChange} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
