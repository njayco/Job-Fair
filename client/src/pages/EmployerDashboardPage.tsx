import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { getEmployerJobs, deleteEmployerJob } from '../api';
import type { EmployerJob } from '../api';
import { Briefcase, Plus, Users, Trash2, Clock } from 'lucide-react';

export default function EmployerDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    if (user && user.account_type !== 'employer') {
      navigate('/', { replace: true });
      return;
    }
    getEmployerJobs()
      .then(d => setJobs(d.jobs))
      .catch(err => setFetchError(err instanceof Error ? err.message : 'Failed to load searches.'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this job search and all its candidates?')) return;
    setDeleting(id);
    try {
      await deleteEmployerJob(id);
      setJobs(prev => prev.filter(j => j.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Briefcase className="w-7 h-7 text-[var(--color-accent)]" />
              <h1 className="text-3xl font-bold font-mono tracking-tight">Employer Dashboard</h1>
            </div>
            <p className="text-[var(--color-text-muted)]">
              Upload resumes, score candidates with AI, and track your hiring pipeline.
            </p>
          </div>
          <Link to="/employer/search">
            <Button variant="primary" className="gap-2 font-mono shrink-0">
              <Plus className="w-4 h-4" />
              NEW SEARCH
            </Button>
          </Link>
        </div>

        {fetchError && (
          <div className="p-4 bg-[var(--color-red-indicator)]/10 border border-[var(--color-red-indicator)]/20 rounded-xl text-[var(--color-red-indicator)] font-mono text-sm">
            {fetchError}
          </div>
        )}

        {/* Stats bar */}
        {jobs.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold font-mono text-[var(--color-primary)]">{jobs.length}</div>
              <div className="text-xs font-mono text-[var(--color-text-muted)] mt-1 uppercase">Job Searches</div>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold font-mono text-[var(--color-primary)]">
                {jobs.reduce((s, j) => s + (j.candidate_count ?? 0), 0)}
              </div>
              <div className="text-xs font-mono text-[var(--color-text-muted)] mt-1 uppercase">Total Candidates</div>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold font-mono text-[var(--color-green-indicator)]">
                {jobs.filter(j => (j.avg_score ?? 0) >= 70).length}
              </div>
              <div className="text-xs font-mono text-[var(--color-text-muted)] mt-1 uppercase">High-Match Roles</div>
            </div>
          </div>
        )}

        {/* Job list */}
        {loading ? (
          <div className="py-16 text-center">
            <Briefcase className="w-8 h-8 text-[var(--color-primary)] mx-auto animate-pulse" />
            <p className="font-mono text-[var(--color-text-muted)] mt-3 animate-pulse">Loading searches…</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center space-y-5 border border-dashed border-[var(--color-border)] rounded-xl">
            <Users className="w-12 h-12 text-[var(--color-text-muted)] mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold font-mono">No searches yet</h2>
              <p className="text-[var(--color-text-muted)] max-w-sm mx-auto text-sm">
                Upload resumes and a job description to find your best candidate.
              </p>
            </div>
            <Link to="/employer/search">
              <Button variant="primary" className="gap-2 font-mono">
                <Plus className="w-4 h-4" />
                START FIRST SEARCH
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-bold font-mono uppercase text-[var(--color-text-muted)]">Past Searches</h2>
            {jobs.map(job => (
              <div
                key={job.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-accent)]/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-[var(--color-text)] font-mono">{job.title}</h3>
                      {job.candidate_count != null && job.candidate_count > 0 && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                          {job.candidate_count} candidate{job.candidate_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {job.avg_score != null && (
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                          job.avg_score >= 80
                            ? 'bg-[var(--color-green-indicator)]/10 text-[var(--color-green-indicator)] border-[var(--color-green-indicator)]/20'
                            : job.avg_score >= 60
                            ? 'bg-[var(--color-yellow-indicator)]/10 text-[var(--color-yellow-indicator)] border-[var(--color-yellow-indicator)]/20'
                            : 'bg-[var(--color-border)]/30 text-[var(--color-text-muted)] border-[var(--color-border)]'
                        }`}>
                          avg {job.avg_score}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">
                      {job.description_text?.slice(0, 160)}…
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--color-text-muted)]">
                      <Clock className="w-3 h-3" />
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDelete(job.id)}
                      disabled={deleting === job.id}
                      className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-red-indicator)] hover:bg-[var(--color-red-indicator)]/5 transition-colors"
                      title="Delete search"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
