import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Terminal, Crosshair, Zap, BarChart, LayoutDashboard, FileText } from 'lucide-react';

export default function LandingPage() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center max-w-4xl mx-auto space-y-12">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-mono text-[var(--color-primary)]">
            <Terminal className="w-4 h-4" />
            <span>v1.0.0 Online</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-text-muted)]">
            High-Signal Career Intelligence
          </h1>
          <p className="text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed">
            Stop applying blindly. Evaluate roles against your background instantly. 
            Know your market value, identify gaps, and tailor your pitch before the first interview.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/evaluate">
            <Button size="lg" className="w-full sm:w-auto text-lg px-8 gap-2 font-mono">
              <Zap className="w-5 h-5" />
              START EVALUATING
            </Button>
          </Link>
          <Link to="/pipeline">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto text-lg px-8 gap-2 font-mono">
              <LayoutDashboard className="w-5 h-5" />
              VIEW PIPELINE
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6 pt-12 w-full text-left">
          <div className="bg-[var(--color-surface)] p-6 rounded-lg border border-[var(--color-border)] space-y-4">
            <div className="w-10 h-10 rounded bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
              <Crosshair className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-mono">Precision Match</h3>
            <p className="text-[var(--color-text-muted)] text-sm">
              Our AI breaks down JDs and compares them to your CV, scoring your fit on a 5-point scale.
            </p>
          </div>
          <div className="bg-[var(--color-surface)] p-6 rounded-lg border border-[var(--color-border)] space-y-4">
            <div className="w-10 h-10 rounded bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)]">
              <BarChart className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-mono">Level & Comp Strategy</h3>
            <p className="text-[var(--color-text-muted)] text-sm">
              Get insights into expected compensation ranges and strategies to pitch at your desired level.
            </p>
          </div>
          <div className="bg-[var(--color-surface)] p-6 rounded-lg border border-[var(--color-border)] space-y-4">
            <div className="w-10 h-10 rounded bg-[var(--color-yellow-indicator)]/10 flex items-center justify-center text-[var(--color-yellow-indicator)]">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-mono">Tailored Action Plan</h3>
            <p className="text-[var(--color-text-muted)] text-sm">
              Receive precise suggestions for tweaking your CV and LinkedIn to match the role perfectly.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
