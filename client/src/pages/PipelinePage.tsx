import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { getApplications, updateApplicationStatus, APP_STATUSES, getSavedJobs, deleteSavedJob } from '../api';
import type { Application, AppStatus, SavedJob } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Plus, ExternalLink, ChevronDown, Clock, ChevronUp, ChevronsUpDown,
  FileText, Sparkles, Bookmark, Trash2, Send, Activity, TrendingUp,
  Star, CheckCircle2, ChevronRight, Briefcase
} from 'lucide-react';

type SortField = 'score' | 'date';
type SortOrder = 'asc' | 'desc';
type FilterValue = 'All' | AppStatus | 'Top';

interface Tab { value: FilterValue; label: string; }
const TABS: Tab[] = [
  { value: 'All', label: 'All' },
  { value: 'Evaluated', label: 'Evaluated' },
  { value: 'Applied', label: 'Applied' },
  { value: 'Interview', label: 'Interview' },
  { value: 'Top', label: 'Top ≥ A-' },
  { value: 'SKIP', label: 'Skip' },
];

const SCORE_LETTER_ORDER = ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'];

function scorePillStyle(score: string | null): { bg: string; text: string; border: string } {
  if (!score) return { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8', border: 'rgba(148,163,184,0.2)' };
  const idx = SCORE_LETTER_ORDER.indexOf(score);
  if (idx <= 2) return { bg: 'rgba(16,185,129,0.12)', text: '#10B981', border: 'rgba(16,185,129,0.25)' };  // A+/A/A-
  if (idx <= 5) return { bg: 'rgba(59,130,246,0.12)', text: '#3B82F6', border: 'rgba(59,130,246,0.25)' };  // B
  if (idx <= 8) return { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', border: 'rgba(245,158,11,0.25)' };  // C
  return { bg: 'rgba(239,68,68,0.12)', text: '#EF4444', border: 'rgba(239,68,68,0.25)' };                  // D/F
}

function statusPillStyle(status: string): { dot: string; border: string } {
  switch (status) {
    case 'Interview':
    case 'Offer':
      return { dot: '#10B981', border: 'rgba(16,185,129,0.3)' };
    case 'Applied':
    case 'Responded':
      return { dot: '#3B82F6', border: 'rgba(59,130,246,0.3)' };
    case 'Evaluated':
      return { dot: '#94A3B8', border: 'rgba(148,163,184,0.2)' };
    case 'Rejected':
    case 'Discarded':
      return { dot: '#EF4444', border: 'rgba(239,68,68,0.3)' };
    default:
      return { dot: '#94A3B8', border: 'rgba(148,163,184,0.2)' };
  }
}

export default function PipelinePage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>('All');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  const fetchApps = async () => {
    try {
      const res = await getApplications({
        sort: sortField === 'date' ? 'created_at' : 'score',
        order: sortOrder,
        limit: 100,
      });
      setApps(res.applications);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSaved = async () => {
    try {
      const res = await getSavedJobs();
      setSavedJobs(res.saved_jobs);
    } catch (e) {
      console.error(e);
    } finally {
      setSavedLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchApps();
    fetchSaved();
  }, [sortField, sortOrder]);

  const handleRemoveSaved = async (id: number) => {
    try {
      await deleteSavedJob(id);
      setSavedJobs(prev => prev.filter(j => j.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusChange = async (id: number, status: AppStatus) => {
    try {
      await updateApplicationStatus(id, status);
      fetchApps();
    } catch (e) {
      console.error(e);
    }
  };

  const evaluatedByUrl = useMemo(() => {
    const map = new Map<string, number>();
    for (const app of apps) {
      if (app.url && (app.status === 'Evaluated' || app.status === 'Applied')) {
        map.set(app.url, app.id);
      }
    }
    return map;
  }, [apps]);

  const filteredApps = apps.filter(app => {
    if (filter === 'All') return true;
    if (filter === 'Top') {
      const idx = SCORE_LETTER_ORDER.indexOf(app.score || '');
      return idx >= 0 && idx <= 2;
    }
    return app.status === filter;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 ml-1 inline opacity-40" />;
    return sortOrder === 'desc'
      ? <ChevronDown className="w-3 h-3 ml-1 inline" style={{ color: '#3B82F6' }} />
      : <ChevronUp className="w-3 h-3 ml-1 inline" style={{ color: '#3B82F6' }} />;
  };

  // Stats
  const totalApps = apps.length;
  const interviewCount = apps.filter(a => a.status === 'Interview' || a.status === 'Offer').length;
  const bestScore = apps.length > 0 ? (apps[0].score || 'N/A') : 'N/A';
  const topScoreApp = apps.find(a => a.score);
  const displayName = user?.email ? user.email.split('@')[0] : 'there';

  return (
    <Layout>
      <div
        className="min-h-screen"
        style={{ backgroundColor: '#0A0F1E' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-10">

          {/* ── Header ── */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1
                className="text-3xl md:text-4xl font-bold mb-2 tracking-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' }}
              >
                Welcome back, {displayName}
              </h1>
              <p style={{ color: '#94A3B8' }}>Here's what's happening with your job search today.</p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="text-sm px-3 py-1.5 rounded-md border"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#94A3B8',
                  backgroundColor: '#0F172A',
                  borderColor: '#1E293B',
                }}
              >
                Status: <span style={{ color: '#10B981' }}>Operational</span>
              </div>
              <Link
                to="/career-match"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors hover:border-[#3B82F6] hover:text-[#F0F4FF]"
                style={{ borderColor: '#1E293B', color: '#94A3B8', backgroundColor: '#0F172A' }}
              >
                <Sparkles size={14} />
                Career Match
              </Link>
              <Link
                to="/evaluate"
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white transition-all"
                style={{ backgroundColor: '#3B82F6', boxShadow: '0 0 15px rgba(59,130,246,0.3)' }}
              >
                <Plus size={15} />
                New Evaluation
              </Link>
            </div>
          </div>

          {/* ── Stats Grid ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              {
                label: 'Active Applications',
                value: totalApps.toString(),
                sub: totalApps > 0 ? `${totalApps} tracked` : 'Start evaluating',
                subColor: '#10B981',
                icon: <Briefcase size={56} />,
                accent: '#3B82F6',
                iconSmall: <Activity size={13} style={{ color: '#3B82F6' }} />,
              },
              {
                label: 'Interviews',
                value: interviewCount.toString(),
                sub: interviewCount > 0 ? 'Active interview stages' : 'Keep applying',
                subColor: '#94A3B8',
                icon: <CheckCircle2 size={56} />,
                accent: '#3B82F6',
                iconSmall: <Clock size={13} style={{ color: '#3B82F6' }} />,
              },
              {
                label: 'Portfolio Grade',
                value: bestScore,
                sub: bestScore !== 'N/A' ? 'Best evaluation score' : 'No scores yet',
                subColor: '#10B981',
                icon: <Star size={56} />,
                accent: '#3B82F6',
                valueColor: bestScore !== 'N/A' ? '#10B981' : '#F0F4FF',
                iconSmall: <Activity size={13} style={{ color: '#3B82F6' }} />,
              },
              {
                label: 'Best Match',
                value: topScoreApp?.company || '—',
                sub: topScoreApp?.role || 'Evaluate more jobs',
                subColor: '#94A3B8',
                icon: <TrendingUp size={56} />,
                accent: '#3B82F6',
                isText: true,
                iconSmall: <Star size={13} style={{ color: '#3B82F6' }} />,
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-lg p-5 border group transition-all"
                style={{
                  backgroundColor: '#0F172A',
                  borderColor: '#1E293B',
                  borderLeftColor: stat.accent,
                  borderLeftWidth: '4px',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(59,130,246,0.12)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.4)';
                  (e.currentTarget as HTMLElement).style.borderLeftColor = stat.accent;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '';
                  (e.currentTarget as HTMLElement).style.borderColor = '#1E293B';
                  (e.currentTarget as HTMLElement).style.borderLeftColor = stat.accent;
                }}
              >
                <div className="absolute right-0 top-0 p-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                  {stat.icon}
                </div>
                <div
                  className="text-xs font-medium mb-1 flex items-center gap-1.5"
                  style={{ color: '#94A3B8' }}
                >
                  {stat.iconSmall}
                  {stat.label}
                </div>
                <div
                  className="text-3xl font-bold"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    color: (stat as any).valueColor || '#F0F4FF',
                    fontSize: stat.isText ? '1.1rem' : undefined,
                    fontWeight: stat.isText ? 600 : undefined,
                    marginTop: stat.isText ? '0.25rem' : undefined,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-xs mt-2 flex items-center gap-1"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: stat.subColor,
                  }}
                >
                  {i === 0 && totalApps > 0 && <TrendingUp size={11} />}
                  {stat.sub}
                </div>
              </div>
            ))}
          </div>

          {/* ── Filter Tabs ── */}
          <div
            className="flex space-x-1 mb-5 overflow-x-auto"
            style={{ borderBottom: '1px solid #1E293B' }}
          >
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className="px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors -mb-px"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  borderBottomColor: filter === tab.value ? '#3B82F6' : 'transparent',
                  color: filter === tab.value ? '#3B82F6' : '#94A3B8',
                }}
              >
                {tab.label}
                {tab.value === 'All' && apps.length > 0 && (
                  <span
                    className="ml-1.5 px-1.5 py-0.5 rounded text-xs"
                    style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
                  >
                    {apps.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Applications Table ── */}
          <div className="mb-4 flex items-center justify-between">
            <h2
              className="text-xl font-bold"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' }}
            >
              Application Pipeline
            </h2>
            <Link
              to="/job-finder"
              className="text-sm font-medium flex items-center gap-1 transition-colors hover:text-[#F0F4FF]"
              style={{ color: '#3B82F6' }}
            >
              Find more jobs <ChevronRight size={15} />
            </Link>
          </div>

          {loading ? (
            <div
              className="py-16 text-center rounded-xl border animate-pulse"
              style={{ color: '#94A3B8', borderColor: '#1E293B', backgroundColor: '#0F172A', fontFamily: "'JetBrains Mono', monospace" }}
            >
              Loading pipeline...
            </div>
          ) : filteredApps.length === 0 ? (
            <div
              className="py-24 text-center border border-dashed rounded-xl"
              style={{ borderColor: '#1E293B' }}
            >
              <p className="mb-4" style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>
                No applications found.
              </p>
              <Link
                to="/evaluate"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white transition-all"
                style={{ backgroundColor: '#3B82F6', boxShadow: '0 0 15px rgba(59,130,246,0.25)' }}
              >
                <Plus size={15} />
                Start First Evaluation
              </Link>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden border shadow-2xl"
              style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr
                      className="text-xs uppercase tracking-wider font-semibold border-b"
                      style={{ backgroundColor: '#0A0F1E', borderColor: '#1E293B', color: '#94A3B8' }}
                    >
                      <th className="py-4 px-5 font-medium">Company & Role</th>
                      <th
                        className="py-4 px-5 font-medium cursor-pointer select-none hover:text-[#F0F4FF] transition-colors"
                        onClick={() => handleSort('score')}
                      >
                        Score <SortIcon field="score" />
                      </th>
                      <th className="py-4 px-5 font-medium hidden md:table-cell">Status</th>
                      <th
                        className="py-4 px-5 font-medium hidden sm:table-cell cursor-pointer select-none hover:text-[#F0F4FF] transition-colors"
                        onClick={() => handleSort('date')}
                      >
                        Applied <SortIcon field="date" />
                      </th>
                      <th className="py-4 px-5 font-medium hidden lg:table-cell">Archetype</th>
                      <th className="py-4 px-5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map((app, idx) => {
                      const pill = scorePillStyle(app.score);
                      const status = statusPillStyle(app.status);
                      return (
                        <tr
                          key={app.id}
                          className="border-b group transition-colors"
                          style={{
                            borderColor: '#1E293B',
                            backgroundColor: idx % 2 === 1 ? 'rgba(10,15,30,0.3)' : 'transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(30,41,59,0.5)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = idx % 2 === 1 ? 'rgba(10,15,30,0.3)' : 'transparent'}
                        >
                          {/* Company & Role */}
                          <td className="py-4 px-5">
                            <Link to={`/results/${app.id}`} className="block">
                              <div
                                className="font-semibold flex items-center gap-2 transition-colors group-hover:text-[#3B82F6]"
                                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' }}
                              >
                                {app.company}
                                {app.url && (
                                  <a
                                    href={app.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{ color: '#94A3B8' }}
                                    className="hover:text-[#3B82F6] transition-colors"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                              <div className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{app.role}</div>
                            </Link>
                          </td>

                          {/* Score */}
                          <td className="py-4 px-5">
                            <span
                              className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold"
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                backgroundColor: pill.bg,
                                color: pill.text,
                                border: `1px solid ${pill.border}`,
                              }}
                            >
                              {app.score || 'N/A'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-5 hidden md:table-cell">
                            <div className="relative w-36">
                              <select
                                value={app.status}
                                onChange={(e) => handleStatusChange(app.id, e.target.value as AppStatus)}
                                className="appearance-none w-full text-xs font-medium rounded-full px-3 py-1 pr-6 transition-colors"
                                style={{
                                  backgroundColor: '#1E293B',
                                  color: '#F0F4FF',
                                  border: `1px solid ${status.border}`,
                                  cursor: 'pointer',
                                }}
                              >
                                {APP_STATUSES.map(s => (
                                  <option key={s} value={s} style={{ backgroundColor: '#0F172A' }}>{s}</option>
                                ))}
                              </select>
                              <span
                                className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: status.dot }}
                              />
                              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-4 px-5 hidden sm:table-cell whitespace-nowrap">
                            <span
                              className="flex items-center gap-1.5 text-xs"
                              style={{ fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}
                            >
                              <Clock size={11} />
                              {new Date(app.created_at).toLocaleDateString()}
                            </span>
                          </td>

                          {/* Archetype */}
                          <td className="py-4 px-5 hidden lg:table-cell text-xs" style={{ color: '#94A3B8' }}>
                            {app.archetype || '—'}
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-5 text-right">
                            <div className="inline-flex items-center justify-end gap-3">
                              {app.url && (app.status === 'Evaluated' || app.status === 'Applied') && (
                                <Link
                                  to={`/apply/${app.id}`}
                                  className="inline-flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-all hover:text-[#3B82F6]"
                                  style={{ color: '#10B981', fontFamily: "'JetBrains Mono', monospace" }}
                                  title="Assisted Apply"
                                >
                                  <Send size={13} />
                                  <span className="hidden md:inline">Apply</span>
                                </Link>
                              )}
                              <Link
                                to={`/report/${app.id}`}
                                className="inline-flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-all hover:text-[#3B82F6]"
                                style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}
                                title="View report"
                              >
                                <FileText size={13} />
                                <span className="hidden md:inline">Report</span>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Saved Jobs ── */}
          {!savedLoading && savedJobs.length > 0 && (
            <div className="space-y-3 pt-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark size={16} style={{ color: '#3B82F6' }} />
                  <h2
                    className="text-xl font-bold"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' }}
                  >
                    Saved Jobs
                  </h2>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8', backgroundColor: '#1E293B' }}
                  >
                    {savedJobs.length}
                  </span>
                </div>
                <p className="text-sm hidden sm:block" style={{ color: '#94A3B8' }}>
                  Jobs bookmarked from Job Finder
                </p>
              </div>

              <div
                className="rounded-xl overflow-hidden border"
                style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr
                        className="text-xs uppercase tracking-wider font-semibold border-b"
                        style={{ backgroundColor: '#0A0F1E', borderColor: '#1E293B', color: '#94A3B8' }}
                      >
                        <th className="py-4 px-5 font-medium">Company & Role</th>
                        <th className="py-4 px-5 font-medium hidden sm:table-cell">Match</th>
                        <th className="py-4 px-5 font-medium hidden sm:table-cell">Saved</th>
                        <th className="py-4 px-5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedJobs.map((job, idx) => (
                        <tr
                          key={job.id}
                          className="border-b group transition-colors"
                          style={{ borderColor: '#1E293B', backgroundColor: idx % 2 === 1 ? 'rgba(10,15,30,0.3)' : 'transparent' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(30,41,59,0.5)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = idx % 2 === 1 ? 'rgba(10,15,30,0.3)' : 'transparent'}
                        >
                          <td className="py-4 px-5">
                            <div
                              className="font-semibold flex items-center gap-2"
                              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' }}
                            >
                              {job.company}
                              {job.url && (
                                <a
                                  href={job.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#94A3B8' }}
                                  className="hover:text-[#3B82F6] transition-colors"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                            <div className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{job.role}</div>
                          </td>
                          <td className="py-4 px-5 hidden sm:table-cell">
                            {job.match_pct != null ? (
                              <span
                                className="text-sm font-bold"
                                style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  color: job.match_pct >= 80 ? '#10B981' : job.match_pct >= 65 ? '#F59E0B' : '#94A3B8',
                                }}
                              >
                                {job.match_pct}%
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>
                          <td className="py-4 px-5 hidden sm:table-cell">
                            <span
                              className="flex items-center gap-1.5 text-xs"
                              style={{ fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}
                            >
                              <Clock size={11} />
                              {new Date(job.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <div className="inline-flex items-center justify-end gap-3">
                              {job.url && evaluatedByUrl.has(job.url) && (
                                <Link
                                  to={`/apply/${evaluatedByUrl.get(job.url)}`}
                                  className="inline-flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-all hover:text-[#3B82F6]"
                                  style={{ color: '#10B981', fontFamily: "'JetBrains Mono', monospace" }}
                                >
                                  <Send size={13} />
                                  <span className="hidden md:inline">Apply</span>
                                </Link>
                              )}
                              <button
                                onClick={() => handleRemoveSaved(job.id)}
                                className="inline-flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-all hover:text-[#EF4444]"
                                style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}
                                title="Remove"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Bottom CTA ── */}
          <div
            className="mt-16 rounded-2xl border py-12 px-6 text-center"
            style={{
              background: 'linear-gradient(to bottom, #0F172A, #0A0F1E)',
              borderColor: '#1E293B',
            }}
          >
            <h2
              className="text-2xl font-bold mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' }}
            >
              Ready for your next opportunity?
            </h2>
            <p className="mb-8 max-w-md mx-auto text-sm" style={{ color: '#94A3B8' }}>
              Evaluate a job description against your profile to get a personalized match score and interview prep guide.
            </p>
            <Link
              to="/evaluate"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-medium text-white transition-all"
              style={{
                backgroundColor: '#3B82F6',
                boxShadow: '0 0 20px rgba(59,130,246,0.2)',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 30px rgba(59,130,246,0.4)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,0.2)')}
            >
              Start New Evaluation
              <ChevronRight size={17} />
            </Link>
          </div>

        </div>
      </div>
    </Layout>
  );
}
