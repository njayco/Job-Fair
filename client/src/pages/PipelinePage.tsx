import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { getApplications, updateApplicationStatus, scoreColor, APP_STATUSES, getSavedJobs, deleteSavedJob } from '../api';
import type { Application, AppStatus, SavedJob } from '../api';
import { Plus, ExternalLink, ChevronDown, Clock, ChevronUp, ChevronsUpDown, FileText, Sparkles, Bookmark, Trash2, Send } from 'lucide-react';

type SortField = 'score' | 'date';
type SortOrder = 'asc' | 'desc';
type FilterValue = 'All' | AppStatus | 'Top';

interface Tab { value: FilterValue; label: string; }
const TABS: Tab[] = [
  { value: 'All', label: 'All' },
  { value: 'Evaluated', label: 'Evaluated' },
  { value: 'Applied', label: 'Applied' },
  { value: 'Interview', label: 'Interview' },
  { value: 'Top', label: 'Top ≥4' },
  { value: 'SKIP', label: 'Skip' },
];

export default function PipelinePage() {
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
    if (filter === 'Top') return parseFloat(app.score || '0') >= 4.0;
    return app.status === filter;
  });

  const getBadgeVariant = (score: string | null) => {
    const c = scoreColor(score);
    if (c === 'green') return 'success';
    if (c === 'yellow') return 'warning';
    if (c === 'red') return 'danger';
    return 'default';
  };

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
      ? <ChevronDown className="w-3 h-3 ml-1 inline text-[var(--color-primary)]" />
      : <ChevronUp className="w-3 h-3 ml-1 inline text-[var(--color-primary)]" />;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold font-mono tracking-tight">Pipeline</h1>
            <p className="text-[var(--color-text-muted)] mt-1">Manage your job applications and evaluations.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/career-match">
              <Button variant="secondary" className="gap-2 font-mono">
                <Sparkles className="w-4 h-4" />
                CAREER MATCHING
              </Button>
            </Link>
            <Link to="/evaluate">
              <Button className="gap-2 font-mono">
                <Plus className="w-4 h-4" />
                NEW EVALUATION
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex space-x-2 border-b border-[var(--color-border)] overflow-x-auto pb-2">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 font-mono text-sm whitespace-nowrap border-b-2 transition-colors ${filter === tab.value ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-[var(--color-text-muted)] font-mono animate-pulse">Loading pipeline...</div>
        ) : filteredApps.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-[var(--color-border)] rounded-lg">
            <p className="text-[var(--color-text-muted)] font-mono mb-4">No applications found.</p>
            <Link to="/evaluate">
              <Button variant="outline" className="font-mono">START FIRST EVALUATION</Button>
            </Link>
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-bg)] border-b border-[var(--color-border)] font-mono text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Role</th>
                  <th
                    className="px-4 py-3 font-medium w-28 cursor-pointer hover:text-[var(--color-text)] select-none"
                    onClick={() => handleSort('score')}
                  >
                    Score <SortIcon field="score" />
                  </th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Archetype</th>
                  <th className="px-4 py-3 font-medium w-40">Status</th>
                  <th
                    className="px-4 py-3 font-medium hidden sm:table-cell w-32 cursor-pointer hover:text-[var(--color-text)] select-none"
                    onClick={() => handleSort('date')}
                  >
                    Date <SortIcon field="date" />
                  </th>
                  <th className="px-4 py-3 font-medium w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredApps.map(app => (
                  <tr key={app.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/results/${app.id}`} className="block group">
                        <div className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors flex items-center gap-2">
                          {app.company}
                          {app.url && (
                            <a
                              href={app.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-[var(--color-text-muted)] text-xs truncate max-w-[200px] lg:hidden">{app.role}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-muted)] text-xs truncate max-w-[200px]">
                      {app.role}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getBadgeVariant(app.score)} className="text-sm px-2">
                        {app.score || 'N/A'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-muted)] text-xs">
                      {app.archetype || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value as AppStatus)}
                          className="appearance-none bg-transparent border border-[var(--color-border)] text-xs font-mono rounded px-2 py-1 pr-6 hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] w-full transition-colors"
                        >
                          {APP_STATUSES.map(s => <option key={s} value={s} className="bg-[var(--color-surface)]">{s}</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-2 top-1.5 pointer-events-none text-[var(--color-text-muted)]" />
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-[var(--color-text-muted)] text-xs whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(app.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {app.url && (app.status === 'Evaluated' || app.status === 'Applied') && (
                          <Link
                            to={`/apply/${app.id}`}
                            className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors"
                            title="Assisted Apply — AI form filler"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Apply</span>
                          </Link>
                        )}
                        <Link
                          to={`/report/${app.id}`}
                          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                          title="View full report"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Report</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Saved Jobs section */}
        {!savedLoading && savedJobs.length > 0 && (
          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[var(--color-primary)]" />
              <h2 className="text-lg font-bold font-mono tracking-tight">Saved Jobs</h2>
              <span className="text-xs font-mono text-[var(--color-text-muted)] ml-1">· {savedJobs.length} bookmarked</span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">Jobs you saved from Job Finder to revisit later.</p>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-bg)] border-b border-[var(--color-border)] font-mono text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Role</th>
                    <th className="px-4 py-3 font-medium w-24">Match</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell w-32">Saved</th>
                    <th className="px-4 py-3 font-medium w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {savedJobs.map(job => (
                    <tr key={job.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--color-text)] flex items-center gap-2">
                          {job.company}
                          {job.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-[var(--color-text-muted)] text-xs truncate max-w-[200px] lg:hidden">{job.role}</div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-muted)] text-xs truncate max-w-[200px]">
                        {job.role}
                      </td>
                      <td className="px-4 py-3">
                        {job.match_pct != null ? (
                          <span className={`text-sm font-mono font-bold ${
                            job.match_pct >= 80 ? 'text-[var(--color-green-indicator)]' :
                            job.match_pct >= 65 ? 'text-[var(--color-yellow-indicator)]' :
                            'text-[var(--color-text-muted)]'
                          }`}>
                            {job.match_pct}%
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-[var(--color-text-muted)] text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-3">
                          {job.url && evaluatedByUrl.has(job.url) && (
                            <Link
                              to={`/apply/${evaluatedByUrl.get(job.url)}`}
                              className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors"
                              title="Assisted Apply — AI form filler"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Apply</span>
                            </Link>
                          )}
                          <button
                            onClick={() => handleRemoveSaved(job.id)}
                            className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                            title="Remove saved job"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
