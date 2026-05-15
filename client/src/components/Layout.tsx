import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, LogOut, Heart, ExternalLink, Plus } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isEmployer = user?.account_type === 'employer';

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'CO';

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navLinkClass = (path: string) =>
    `py-1 text-sm font-medium transition-colors ${
      isActive(path)
        ? 'text-[#F0F4FF] border-b-2 border-[#3B82F6]'
        : 'text-[#94A3B8] hover:text-[#F0F4FF] border-b-2 border-transparent'
    }`;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0A0F1E' }}>
      {/* Radial gradient behind nav */}
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-[500px]"
        style={{ background: 'radial-gradient(circle at top, rgba(59,130,246,0.08) 0%, rgba(10,15,30,0) 50%)', zIndex: 0 }}
      />

      <header
        className="sticky top-0 z-50 border-b px-6"
        style={{ borderColor: '#1E293B', backgroundColor: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">

          {/* Logo + nav links */}
          <div className="flex items-center gap-8">
            <Link
              to={isEmployer ? '/employer' : '/'}
              className="flex items-center gap-2 text-[#F0F4FF]"
            >
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: '#3B82F6' }}>
                <TrendingUp size={18} className="text-white" />
              </div>
              <span
                className="font-bold text-lg tracking-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Career Ops
              </span>
              {isEmployer && (
                <span
                  className="hidden sm:inline text-xs px-1.5 py-0.5 rounded ml-1"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    backgroundColor: 'rgba(16,185,129,0.12)',
                    color: '#10B981',
                    border: '1px solid rgba(16,185,129,0.2)',
                  }}
                >
                  EMPLOYER
                </span>
              )}
            </Link>

            {user && (
              <nav className="hidden md:flex items-center gap-6">
                {isEmployer ? (
                  <>
                    <Link to="/employer" className={navLinkClass('/employer')}>
                      Dashboard
                    </Link>
                    <Link to="/employer/search" className={navLinkClass('/employer/search')}>
                      New Search
                    </Link>
                    <Link to="/employer/pipeline" className={navLinkClass('/employer/pipeline')}>
                      Pipeline
                    </Link>
                    {user.is_admin && (
                      <Link to="/admin" className="py-1 text-sm font-medium text-amber-500/80 hover:text-amber-400 border-b-2 border-transparent transition-colors">
                        Admin
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <Link to="/pipeline" className={navLinkClass('/pipeline')}>
                      Pipeline
                    </Link>
                    <Link to="/career-match" className={navLinkClass('/career-match')}>
                      Career Match
                    </Link>
                    <Link to="/job-finder" className={navLinkClass('/job-finder')}>
                      Job Finder
                    </Link>
                    <Link to="/scanner" className={navLinkClass('/scanner')}>
                      Scanner
                    </Link>
                    {user.is_admin && (
                      <Link to="/admin" className="py-1 text-sm font-medium text-amber-500/80 hover:text-amber-400 border-b-2 border-transparent transition-colors">
                        Admin
                      </Link>
                    )}
                  </>
                )}
              </nav>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/evaluate"
                  className="hidden sm:flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md text-white transition-all"
                  style={{
                    backgroundColor: '#3B82F6',
                    boxShadow: '0 0 15px rgba(59,130,246,0.3)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 25px rgba(59,130,246,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 15px rgba(59,130,246,0.3)')}
                >
                  <Plus size={15} />
                  Evaluate Job
                </Link>

                <div className="h-6 w-px mx-1" style={{ backgroundColor: '#1E293B' }} />

                <Link
                  to="/account"
                  className="flex items-center justify-center w-9 h-9 rounded-full border text-sm font-semibold transition-colors hover:border-[#3B82F6]"
                  style={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    color: '#F0F4FF',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                  title={user.email}
                >
                  {initials}
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
                  style={{ color: '#94A3B8' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium transition-colors"
                  style={{ color: '#94A3B8' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#F0F4FF')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-medium px-4 py-2 rounded-md text-white transition-all"
                  style={{
                    backgroundColor: '#3B82F6',
                    boxShadow: '0 0 15px rgba(59,130,246,0.25)',
                  }}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {children}
      </main>

      <footer
        className="border-t mt-auto relative z-10"
        style={{ borderColor: '#1E293B', backgroundColor: '#0F172A' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm" style={{ color: '#94A3B8' }}>
            <div className="flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <span>Built by</span>
              <a
                href="https://njayco.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-1 hover:underline"
                style={{ color: '#3B82F6' }}
              >
                NJAYCO
                <ExternalLink size={12} />
              </a>
            </div>
            {!isEmployer && (
              <Link
                to="/donate"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[#F0F4FF]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <Heart size={13} />
                Support this project
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
