import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { getApplications, updateApplicationStatus, scoreColor, APP_STATUSES } from '../api';
import type { Application, AppStatus } from '../api';
import { Plus, ExternalLink, FileText, ChevronDown, Clock } from 'lucide-react';

export default function PipelinePage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | AppStatus | 'Top'>('All');

  const fetchApps = async () => {
    try {
      const res = await getApplications({ sort: 'score', order: 'desc', limit: 100 });
      setApps(res.applications);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleStatusChange = async (id: number, status: AppStatus) => {
    try {
      await updateApplicationStatus(id, status);
      fetchApps(); // Refresh
    } catch (e) {
      console.error(e);
    }
  };

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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold font-mono tracking-tight">Pipeline</h1>
            <p className="text-[var(--color-text-muted)] mt-1">Manage your job applications and evaluations.</p>
          </div>
          <Link to="/evaluate">
            <Button className="gap-2 font-mono">
              <Plus className="w-4 h-4" />
              NEW EVALUATION
            </Button>
          </Link>
        </div>

        <div className="flex space-x-2 border-b border-[var(--color-border)] overflow-x-auto pb-2">
          {['All', 'Evaluated', 'Applied', 'Interview', 'Top', 'SKIP'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab as any)}
              className={`px-3 py-1.5 font-mono text-sm whitespace-nowrap border-b-2 transition-colors ${filter === tab ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            >
              {tab}
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
                  <th className="px-4 py-3 font-medium">Company & Role</th>
                  <th className="px-4 py-3 font-medium w-24">Score</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Archetype</th>
                  <th className="px-4 py-3 font-medium w-40">Status</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell w-32">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredApps.map(app => (
                  <tr key={app.id} className="hover:bg-[var(--color-surface-hover)] transition-colors group cursor-pointer" onClick={(e) => {
                    // Prevent navigation if clicking select
                    if ((e.target as HTMLElement).tagName !== 'SELECT') {
                      navigate(`/results/${app.id}`);
                    }
                  }}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--color-text)] flex items-center gap-2">
                        {app.company}
                        {app.url && (
                          <a href={app.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="text-[var(--color-text-muted)] text-xs truncate max-w-[250px]">{app.role}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getBadgeVariant(app.score)} className="text-sm px-2">
                        {app.score || 'N/A'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-muted)] text-xs">
                      {app.archetype || '-'}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
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
                    <td className="px-4 py-3 hidden sm:table-cell text-[var(--color-text-muted)] text-xs whitespace-nowrap flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
