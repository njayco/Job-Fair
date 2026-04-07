import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { User, LogOut, Mail, Calendar } from 'lucide-react';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">Account</h1>
          <p className="text-[var(--color-text-muted)] mt-1">Your profile and session.</p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
              <User className="w-7 h-7" />
            </div>
            <div>
              <div className="font-semibold text-lg">{user.email}</div>
              <div className="text-xs font-mono text-[var(--color-text-muted)]">ID #{user.id}</div>
            </div>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            <div className="py-3 flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
              <span className="text-[var(--color-text-muted)] w-24 font-mono text-xs uppercase">Email</span>
              <span>{user.email}</span>
            </div>
            <div className="py-3 flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
              <span className="text-[var(--color-text-muted)] w-24 font-mono text-xs uppercase">Plan</span>
              <span>Free</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)]">
            <Button variant="danger" onClick={handleLogout} className="gap-2 font-mono">
              <LogOut className="w-4 h-4" />
              SIGN OUT
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
