import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, LayoutDashboard, FileText } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="flex items-center gap-2">
              <Terminal className="text-[var(--color-primary)] w-6 h-6" />
              <span className="font-mono font-bold text-lg tracking-tight">CAREER_OPS</span>
            </Link>
            <nav className="flex gap-4">
              <Link to="/pipeline" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-primary)] transition-colors text-[var(--color-text-muted)]">
                <LayoutDashboard className="w-4 h-4" />
                Pipeline
              </Link>
              <Link to="/evaluate" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--color-accent)] transition-colors text-[var(--color-text-muted)]">
                <FileText className="w-4 h-4" />
                New Evaluation
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
