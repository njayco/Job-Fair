import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { CreditCard, Zap, BarChart2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface BillingStatus {
  plan: 'free' | 'pro';
  status: string | null;
  usageCount: number;
  freeLimit: number;
  limitReached: boolean;
  subscription: {
    id: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
}

export default function BillingPage() {
  useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');

  const params = new URLSearchParams(window.location.search);
  const justUpgraded = params.get('success') === '1';

  useEffect(() => {
    fetch('/api/billing/status', { credentials: 'include' })
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setError('Failed to load billing status'))
      .finally(() => setLoading(false));
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open portal');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">Billing</h1>
          <p className="text-[var(--color-text-muted)] mt-1">Your plan and usage.</p>
        </div>

        {justUpgraded && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-semibold">Welcome to Pro!</div>
              <div className="text-sm opacity-80">You now have unlimited evaluations.</div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-[var(--color-red-indicator)]/10 border border-[var(--color-red-indicator)]/20 rounded text-[var(--color-red-indicator)] font-mono text-sm">
            {error}
          </div>
        )}

        {status && (
          <>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Current Plan</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono capitalize">{status.plan}</span>
                    {status.plan === 'pro' && (
                      <span className="text-xs bg-[var(--color-primary)]/20 text-[var(--color-primary)] px-2 py-0.5 rounded font-mono uppercase">Active</span>
                    )}
                  </div>
                </div>
                {status.plan === 'free' ? (
                  <Link to="/pricing">
                    <Button size="sm" className="gap-2 font-mono">
                      <Zap className="w-3 h-3" />
                      UPGRADE
                    </Button>
                  </Link>
                ) : (
                  <CreditCard className="w-6 h-6 text-[var(--color-primary)]" />
                )}
              </div>

              <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
                <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                  Evaluations This Month
                </div>
                {status.plan === 'free' ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{status.usageCount} of {status.freeLimit} used</span>
                      <span className={status.limitReached ? 'text-[var(--color-red-indicator)]' : 'text-[var(--color-text-muted)]'}>
                        {status.freeLimit - status.usageCount} remaining
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${status.limitReached ? 'bg-[var(--color-red-indicator)]' : 'bg-[var(--color-primary)]'}`}
                        style={{ width: `${Math.min(100, (status.usageCount / status.freeLimit) * 100)}%` }}
                      />
                    </div>
                    {status.limitReached && (
                      <div className="flex items-start gap-2 text-xs text-[var(--color-red-indicator)]">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        Limit reached. Upgrade to Pro for unlimited evaluations.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                    <BarChart2 className="w-4 h-4" />
                    <span>{status.usageCount} evaluations this month — unlimited</span>
                  </div>
                )}
              </div>

              {status.plan === 'pro' && status.subscription && (
                <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
                  {status.subscription.current_period_end && (
                    <div className="text-sm text-[var(--color-text-muted)]">
                      {status.subscription.cancel_at_period_end
                        ? `Cancels on ${new Date(status.subscription.current_period_end).toLocaleDateString()}`
                        : `Renews on ${new Date(status.subscription.current_period_end).toLocaleDateString()}`}
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    className="w-full font-mono gap-2"
                    onClick={openPortal}
                    disabled={portalLoading}
                  >
                    {portalLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />OPENING PORTAL...</>
                    ) : (
                      <><CreditCard className="w-4 h-4" />MANAGE BILLING</>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {status.plan === 'free' && (
              <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl p-5 space-y-3">
                <div className="font-semibold">Upgrade to Pro</div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Get unlimited AI evaluations + ATS-optimised PDF generation for $19/month.
                </p>
                <Link to="/pricing">
                  <Button className="gap-2 font-mono">
                    <Zap className="w-4 h-4" />
                    SEE PRICING
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
