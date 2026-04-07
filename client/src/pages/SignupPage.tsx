import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Terminal, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/pipeline', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password);
      navigate('/pipeline', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
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
          <p className="text-[var(--color-text-muted)] text-sm">Create your account</p>
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
                placeholder="Minimum 8 characters"
                required
                disabled={loading}
                className="w-full font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-mono text-[var(--color-text-muted)] uppercase">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full font-mono text-sm"
              />
            </div>
            <Button type="submit" size="lg" className="w-full font-mono" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />CREATING ACCOUNT...</> : 'CREATE ACCOUNT'}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--color-text-muted)]">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--color-primary)] hover:underline font-mono">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
