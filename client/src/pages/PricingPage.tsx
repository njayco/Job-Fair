import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Check, Zap, Loader2 } from 'lucide-react';

interface Price {
  price_id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  product_name: string;
  product_description: string;
}

const FREE_FEATURES = [
  '3 AI evaluations per month',
  'Full A–F structured evaluation',
  'Role classification & CV match',
  'Gap analysis & STAR prep',
  'Pipeline tracker',
];

const PRO_FEATURES = [
  'Unlimited AI evaluations',
  'Everything in Free',
  'ATS-optimised PDF generation',
  'Priority evaluation processing',
  'Cancel anytime',
];

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPrices, setFetchingPrices] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/billing/prices', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setPrices(data.prices || []))
      .catch(() => {})
      .finally(() => setFetchingPrices(false));
  }, []);

  const proPrice = prices[0];

  const handleUpgrade = async () => {
    if (!user) {
      navigate('/signup');
      return;
    }
    if (!proPrice) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId: proPrice.price_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold font-mono tracking-tight">Pricing</h1>
          <p className="text-[var(--color-text-muted)] max-w-xl mx-auto">
            Start free. Upgrade when you need more.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-[var(--color-red-indicator)]/10 border border-[var(--color-red-indicator)]/20 rounded text-[var(--color-red-indicator)] font-mono text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Free tier */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 space-y-6">
            <div>
              <div className="font-mono text-sm text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Free</div>
              <div className="text-4xl font-bold">$0</div>
              <div className="text-[var(--color-text-muted)] text-sm mt-1">No credit card required</div>
            </div>
            <ul className="space-y-3">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link to={user ? '/pipeline' : '/signup'} className="block">
              <Button variant="secondary" className="w-full font-mono">
                {user ? 'CURRENT PLAN' : 'GET STARTED FREE'}
              </Button>
            </Link>
          </div>

          {/* Pro tier */}
          <div className="bg-[var(--color-surface)] border-2 border-[var(--color-primary)] rounded-xl p-8 space-y-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-primary)] text-white text-xs font-mono px-3 py-1 rounded-full uppercase tracking-wider">
              Most Popular
            </div>
            <div>
              <div className="font-mono text-sm text-[var(--color-primary)] uppercase tracking-widest mb-2">Pro</div>
              {fetchingPrices ? (
                <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading price...</span>
                </div>
              ) : proPrice ? (
                <>
                  <div className="text-4xl font-bold">
                    {formatPrice(proPrice.unit_amount, proPrice.currency)}
                    <span className="text-lg font-normal text-[var(--color-text-muted)]">
                      /{proPrice.recurring?.interval || 'month'}
                    </span>
                  </div>
                  <div className="text-[var(--color-text-muted)] text-sm mt-1">Cancel anytime</div>
                </>
              ) : (
                <div className="text-4xl font-bold">$19<span className="text-lg font-normal text-[var(--color-text-muted)]">/month</span></div>
              )}
            </div>
            <ul className="space-y-3">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
                  <span className={f === 'Unlimited AI evaluations' ? 'font-semibold' : ''}>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full font-mono gap-2"
              onClick={handleUpgrade}
              disabled={loading || fetchingPrices || !proPrice}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />REDIRECTING...</>
              ) : (
                <><Zap className="w-4 h-4" />UPGRADE TO PRO</>
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)]">
          Payments are handled securely by Stripe. We never store your card details.
        </p>
      </div>
    </Layout>
  );
}
