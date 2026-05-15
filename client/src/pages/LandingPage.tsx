import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { Terminal, Crosshair, Zap, BarChart, FileText, Heart, ExternalLink, User, Briefcase, ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuth();
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto space-y-12 py-8">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-mono text-[var(--color-primary)]">
            <Terminal className="w-4 h-4" />
            <span>v1.0.0 · Free forever</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-text-muted)]">
            Land Your Dream Job
          </h1>
          <p className="text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed">
            Stop applying blindly. Evaluate roles against your background instantly. 
            Know your market value, identify gaps, and tailor your pitch before the first interview.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/job-finder">
            <Button size="lg" className="w-full sm:w-auto text-lg px-8 gap-2 font-mono">
              <Zap className="w-5 h-5" />
              START SEARCH
            </Button>
          </Link>
          {user?.is_admin && (
            <Link to="/admin">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 gap-2 font-mono border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                <ShieldCheck className="w-5 h-5" />
                ADMIN
              </Button>
            </Link>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 pt-4 w-full text-left">
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

        {/* Dual-side role section */}
        <div className="w-full grid sm:grid-cols-2 gap-6 pt-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 space-y-4 text-left">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold font-mono">Employee</h2>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
              Evaluate job fit, discover matching careers, find real openings, and track your applications — all powered by AI.
            </p>
            <p className="text-xs font-mono text-[var(--color-primary)] font-bold">Find the right jobs.</p>
            <Link to="/signup">
              <Button variant="outline" className="w-full font-mono mt-2">GET STARTED FREE</Button>
            </Link>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-accent)]/30 rounded-xl p-8 space-y-4 text-left">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)]">
              <Briefcase className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold font-mono">Employer</h2>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
              Upload resumes, rank every applicant with AI, generate interview questions, and track your hiring pipeline.
            </p>
            <p className="text-xs font-mono text-[var(--color-accent)] font-bold">Find the right people.</p>
            <Link to="/signup?role=employer">
              <Button variant="outline" className="w-full font-mono mt-2 border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5">HIRE WITH AI</Button>
            </Link>
          </div>
        </div>

        <div className="w-full border-t border-[var(--color-border)] pt-12 space-y-10">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-8 space-y-4 text-center">
            <Heart className="w-8 h-8 text-[var(--color-primary)] mx-auto" />
            <h2 className="text-2xl font-bold font-mono">Career-Ops is free. Help keep it that way.</h2>
            <p className="text-[var(--color-text-muted)] max-w-lg mx-auto">
              If this tool helped you land an interview or negotiate a better offer, consider supporting it. 
              A small donation keeps the servers running and the tool free for everyone.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href="https://cash.app/$najeejeremiah"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded font-mono font-bold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
              >
                Donate via Cash App · <span className="text-white/80">$najeejeremiah</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <Link
                to="/donate"
                className="text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                Learn more →
              </Link>
            </div>
          </div>

          <div className="text-center space-y-3">
            <p className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">Built by</p>
            <a
              href="https://njayco.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono font-bold text-lg hover:text-[var(--color-primary)] transition-colors"
            >
              NJAYCO — The Najee Jeremiah Company
              <ExternalLink className="w-4 h-4" />
            </a>
            <p className="text-sm text-[var(--color-text-muted)]">
              Building tools that help people work smarter and create their own opportunities.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
