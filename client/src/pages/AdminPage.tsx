import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

interface AdminStats {
  totalUsers: number;
  employees: number;
  employers: number;
  totalViews: number;
  views7d: number;
  topReferrers: { referrer: string; count: number; lastSeen: string }[];
}

interface RecentUser {
  id: number;
  email: string;
  account_type: string;
  is_admin: boolean;
  created_at: string;
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-1">{label}</div>
      <div className="text-3xl font-bold text-[var(--color-text)]">{value.toLocaleString()}</div>
      {sub && <div className="mt-1 text-sm text-[var(--color-text-muted)]">{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.is_admin) return;

    Promise.all([
      fetch('/api/admin/stats', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/recent-signups', { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([statsData, signupsData]) => {
        if (statsData.error) throw new Error(statsData.error);
        setStats(statsData);
        setRecentUsers(signupsData.users ?? []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user?.is_admin) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl font-bold text-[var(--color-text-muted)] mb-4">403</div>
            <div className="text-[var(--color-text-muted)]">You don't have permission to view this page.</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Admin Dashboard</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Platform analytics & user stats</p>
        </div>

        {loading && (
          <div className="text-[var(--color-text-muted)] animate-pulse">Loading analytics…</div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {stats && !loading && (
          <>
            {/* Visitor overview */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
                Visitors
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Total Page Views" value={stats.totalViews} />
                <StatCard label="Last 7 Days" value={stats.views7d} />
                <StatCard label="Total Users" value={stats.totalUsers} />
                <StatCard
                  label="Accounts Split"
                  value={`${stats.employees} / ${stats.employers}`}
                  sub="employees / employers"
                />
              </div>
            </section>

            {/* User accounts */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
                User Accounts
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard label="Employees" value={stats.employees} />
                <StatCard label="Employers" value={stats.employers} />
                <StatCard label="Total Registered" value={stats.totalUsers} />
              </div>
            </section>

            {/* Top referrers */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
                Top Referrers
              </h2>
              {stats.topReferrers.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No referrer data yet.</p>
              ) : (
                <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-left">
                        <th className="px-4 py-3 text-[var(--color-text-muted)] font-medium">#</th>
                        <th className="px-4 py-3 text-[var(--color-text-muted)] font-medium">Referrer</th>
                        <th className="px-4 py-3 text-[var(--color-text-muted)] font-medium text-right">Hits</th>
                        <th className="px-4 py-3 text-[var(--color-text-muted)] font-medium text-right">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topReferrers.map((r, i) => (
                        <tr key={r.referrer} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover,#ffffff08)]">
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">{i + 1}</td>
                          <td className="px-4 py-3 font-mono text-[var(--color-text)] max-w-xs truncate">{r.referrer}</td>
                          <td className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">{r.count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-[var(--color-text-muted)]">
                            {new Date(r.lastSeen).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Recent signups */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
                Recent Signups
              </h2>
              {recentUsers.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No users yet.</p>
              ) : (
                <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-left">
                        <th className="px-4 py-3 text-[var(--color-text-muted)] font-medium">ID</th>
                        <th className="px-4 py-3 text-[var(--color-text-muted)] font-medium">Email</th>
                        <th className="px-4 py-3 text-[var(--color-text-muted)] font-medium">Type</th>
                        <th className="px-4 py-3 text-[var(--color-text-muted)] font-medium text-right">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentUsers.map(u => (
                        <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover,#ffffff08)]">
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">{u.id}</td>
                          <td className="px-4 py-3 text-[var(--color-text)] font-mono">
                            {u.email}
                            {u.is_admin && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-sans">admin</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              u.account_type === 'employer'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {u.account_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--color-text-muted)]">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
