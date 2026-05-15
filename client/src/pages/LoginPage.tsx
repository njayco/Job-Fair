import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Terminal, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationFrom = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const defaultRedirect = (u: typeof user) =>
    u?.is_admin ? '/admin' : u?.account_type === 'employer' ? '/employer' : '/pipeline';

  useEffect(() => {
    if (user) navigate(locationFrom || defaultRedirect(user), { replace: true });
  }, [user, navigate, locationFrom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // user state updates asynchronously via useEffect above
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 text-[var(--color-primary)] font-mono font-bold text-xl">
            <Terminal className="w-6 h-6" />
            CAREER_OPS
          </Link>
          <p className="text-[var(--color-text-muted)] text-sm">Sign in to your account</p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 space-y-6">
          {error && (
            <div className="p-3 bg-[var(--color-red-indicator)]/10 border border-[var(--color-red-indicator)]/20 rounded text-[var(--color-red-indicator)] font-mono text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-mono text-[var(--color-text-muted)] uppercase">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                className="w-full font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-mono text-[var(--color-text-muted)] uppercase">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full font-mono text-sm"
              />
            </div>
            <Button type="submit" size="lg" className="w-full font-mono" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />SIGNING IN...</> : 'SIGN IN'}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--color-text-muted)]">
            No account?{' '}
            <Link to="/signup" className="text-[var(--color-primary)] hover:underline font-mono">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
