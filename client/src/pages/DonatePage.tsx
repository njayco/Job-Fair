import Layout from '../components/Layout';
import { Heart, ExternalLink, Terminal } from 'lucide-react';

export default function DonatePage() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-12 py-8">

        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-mono text-[var(--color-primary)]">
            <Heart className="w-4 h-4" />
            <span>Support Career-Ops</span>
          </div>
          <h1 className="text-4xl font-bold font-mono tracking-tight">Keep it free.</h1>
          <p className="text-[var(--color-text-muted)] text-lg leading-relaxed">
            Career-Ops is free to use and always will be. If it helped you land an interview, 
            negotiate a better offer, or just saved you hours of guesswork — consider buying me a coffee.
          </p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-8 space-y-6 text-center">
          <div className="space-y-2">
            <p className="text-sm font-mono text-[var(--color-text-muted)] uppercase tracking-wider">Donate via Cash App</p>
            <p className="text-5xl font-bold font-mono text-[var(--color-primary)]">$najeejeremiah</p>
          </div>
          <a
            href="https://cash.app/$najeejeremiah"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3 rounded font-mono font-bold text-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
          >
            Open Cash App
            <ExternalLink className="w-5 h-5" />
          </a>
          <p className="text-xs text-[var(--color-text-muted)] font-mono">
            Any amount is genuinely appreciated. Thank you.
          </p>
        </div>

        <div className="border-t border-[var(--color-border)] pt-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">Built by</p>
              <p className="font-mono font-bold">NJAYCO — The Najee Jeremiah Company</p>
            </div>
          </div>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Career-Ops is one of several tools built under NJAYCO. We build software that helps people 
            work smarter, navigate careers, and create opportunities for themselves.
          </p>
          <a
            href="https://njayco.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[var(--color-primary)] font-mono font-medium hover:underline"
          >
            Explore more at njayco.com
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

      </div>
    </Layout>
  );
}
