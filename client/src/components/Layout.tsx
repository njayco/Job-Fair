import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Terminal, LayoutDashboard, FileText, User, LogOut, Heart, ExternalLink, Sparkles, Search, Plus, Kanban, Radar, ShieldCheck } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isEmployer = user?.account_type === 'employer';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to={isEmployer ? '/employer' : '/'} className="flex items-center gap-2">
              <Terminal className="text-[var(--color-primary)] w-6 h-6" />
              <span className="font-mono font-bold text-lg tracking-tight">CAREER_OPS</span>
              {isEmployer && (
                <span className="hidden sm:inline text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/20 ml-1">
                  EMPLOYER
                </span>
              )}
            </Link>

            <nav className="flex items-center gap-4">
              {user ? (
                isEmployer ? (
                  /* ── Employer nav ── */
                  <>
                    <Link to="/employer" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-accent)] transition-colors text-[var(--color-text-muted)]">
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <Link to="/employer/search" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-accent)] transition-colors text-[var(--color-text-muted)]">
                      <Plus className="w-4 h-4" />
                      New Search
                    </Link>
                    <Link to="/employer/pipeline" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-accent)] transition-colors text-[var(--color-text-muted)]">
                      <Kanban className="w-4 h-4" />
                      Pipeline
                    </Link>
                    {user.is_admin && (
                      <Link to="/admin" className="flex items-center gap-2 text-sm font-medium hover:text-amber-400 transition-colors text-amber-500/70">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Admin</span>
                      </Link>
                    )}
                    <Link to="/account" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-primary)] transition-colors text-[var(--color-text-muted)]">
                      <User className="w-4 h-4" />
                      <span className="hidden sm:inline max-w-[140px] truncate">{user.email}</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-red-indicator)] transition-colors"
                      title="Sign out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  /* ── Employee nav ── */
                  <>
                    <Link to="/pipeline" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-primary)] transition-colors text-[var(--color-text-muted)]">
                      <LayoutDashboard className="w-4 h-4" />
                      Pipeline
                    </Link>
                    <Link to="/career-match" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-primary)] transition-colors text-[var(--color-text-muted)]">
                      <Sparkles className="w-4 h-4" />
                      Career Matching
                    </Link>
                    <Link to="/job-finder" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-primary)] transition-colors text-[var(--color-text-muted)]">
                      <Search className="w-4 h-4" />
                      Job Finder
                    </Link>
                    <Link to="/scanner" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-primary)] transition-colors text-[var(--color-text-muted)]">
                      <Radar className="w-4 h-4" />
                      Scanner
                    </Link>
                    <Link to="/evaluate" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-accent)] transition-colors text-[var(--color-text-muted)]">
                      <FileText className="w-4 h-4" />
                      New Evaluation
                    </Link>
                    {user.is_admin && (
                      <Link to="/admin" className="flex items-center gap-2 text-sm font-medium hover:text-amber-400 transition-colors text-amber-500/70">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Admin</span>
                      </Link>
                    )}
                    <Link to="/account" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-primary)] transition-colors text-[var(--color-text-muted)]">
                      <User className="w-4 h-4" />
                      <span className="hidden sm:inline max-w-[140px] truncate">{user.email}</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-red-indicator)] transition-colors"
                      title="Sign out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </>
                )
              ) : (
                <>
                  <Link to="/login" className="text-sm font-medium hover:text-[var(--color-primary)] transition-colors text-[var(--color-text-muted)]">
                    Sign In
                  </Link>
                  <Link to="/signup" className="text-sm font-mono font-medium px-3 py-1.5 rounded border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
                    Sign Up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-text-muted)]">
            <div className="flex items-center gap-1 font-mono">
              <span>Built by</span>
              <a
                href="https://njayco.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1 ml-1"
              >
                NJAYCO
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {!isEmployer && (
              <Link
                to="/donate"
                className="inline-flex items-center gap-1.5 font-mono hover:text-[var(--color-primary)] transition-colors"
              >
                <Heart className="w-3.5 h-3.5" />
                Support this project
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
