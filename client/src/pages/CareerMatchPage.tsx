import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { careerMatch, getCareerMatchHistory, getCareerMatch, getCv } from '../api';
import type { CareerMatchResult, CareerMatchHistoryItem } from '../api';
import {
  Sparkles, Copy, Check, TrendingUp, Star,
  Clock, AlertCircle, RotateCcw, Link2, FileText,
} from 'lucide-react';

function CopyButton({ text, label = 'COPY' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-[var(--color-green-indicator)]" /> : <Copy className="w-3 h-3" />}
      {copied ? 'COPIED' : label}
    </button>
  );
}

function MatchPctRing({ pct }: { pct: number }) {
  const color =
    pct >= 85 ? 'text-[var(--color-green-indicator)]' :
    pct >= 70 ? 'text-[var(--color-yellow-indicator)]' :
    'text-[var(--color-text-muted)]';
  return (
    <div className={`text-3xl font-bold font-mono tabular-nums ${color}`}>
      {pct}%
    </div>
  );
}

function DifficultyBadge({ level }: { level: string }) {
  const lower = level.toLowerCase();
  const color =
    lower.includes('easy') ? 'text-[var(--color-green-indicator)] border-[var(--color-green-indicator)]/30 bg-[var(--color-green-indicator)]/5' :
    lower.includes('moderate') ? 'text-[var(--color-yellow-indicator)] border-[var(--color-yellow-indicator)]/30 bg-[var(--color-yellow-indicator)]/5' :
    'text-[var(--color-red-indicator)] border-[var(--color-red-indicator)]/30 bg-[var(--color-red-indicator)]/5';
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${color}`}>{level}</span>
  );
}

export default function CareerMatchPage() {
  const [result, setResult] = useState<CareerMatchResult | null>(null);
  const [history, setHistory] = useState<CareerMatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [noCV, setNoCV] = useState(false);
  const [cvText, setCvText] = useState('');

  useEffect(() => {
    Promise.all([
      getCareerMatchHistory().then(d => setHistory(d.history)).catch(() => {}),
      getCv().then(cv => {
        if (!cv.content_md || cv.content_md.trim().length < 50) {
          setNoCV(true);
        } else {
          setCvText(cv.content_md);
        }
      }).catch(() => setNoCV(true)),
    ]).finally(() => setHistoryLoading(false));
  }, []);

  const handleRun = async () => {
    const cvToSend = cvText.trim();
    if (cvToSend.length < 50) {
      setError('Please paste your resume before running the analysis.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await careerMatch(cvToSend);
      setResult(r);
      setNoCV(false);
      const newEntry: CareerMatchHistoryItem = {
        id: r.id,
        top_role: r.career_matches[0]?.role ?? null,
        top_pct: r.career_matches[0]?.match_pct ?? null,
        created_at: r.created_at,
      };
      setHistory(prev => [newEntry, ...prev.filter(h => h.id !== r.id)]);
      setTimeout(() => {
        document.getElementById('career-match-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadHistory = async (id: number) => {
    setLoading(true);
    setError('');
    try {
      const r = await getCareerMatch(id);
      setResult(r);
      setTimeout(() => {
        document.getElementById('career-match-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load result.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-[var(--color-primary)]" />
            <h1 className="text-3xl font-bold font-mono tracking-tight">Career Matching</h1>
          </div>
          <p className="text-[var(--color-text-muted)] max-w-2xl">
            AI analyzes your full background — work history, skills, accomplishments — to identify the careers you're most naturally aligned with, surface hidden strengths, and sharpen your professional positioning.
          </p>
        </div>

        {/* CV input — shown when no saved CV exists, or always available as a collapsible */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-sm font-bold font-mono uppercase text-[var(--color-text)]">Your Resume</span>
            {!noCV && cvText && (
              <span className="text-xs font-mono text-[var(--color-green-indicator)] ml-1">· saved CV loaded</span>
            )}
            {noCV && (
              <span className="flex items-center gap-1 text-xs font-mono text-[var(--color-accent)] ml-1">
                <AlertCircle className="w-3 h-3" /> no saved CV
              </span>
            )}
          </div>
          <textarea
            value={cvText}
            onChange={e => setCvText(e.target.value)}
            placeholder="Paste your full resume here (plain text or markdown)…"
            rows={noCV ? 12 : 6}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-sm font-mono text-[var(--color-text)] placeholder-[var(--color-text-muted)] resize-y focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Edit or replace your resume here before running the analysis. Your CV will be saved automatically.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-[var(--color-red-indicator)]/5 border border-[var(--color-red-indicator)]/30 rounded-xl text-sm text-[var(--color-red-indicator)]">
            {error}
          </div>
        )}

        {/* Run + History */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Button
            onClick={handleRun}
            disabled={loading}
            className="gap-2 font-mono"
            variant="primary"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? 'ANALYZING YOUR CAREER...' : result ? 'RUN NEW ANALYSIS' : 'RUN CAREER ANALYSIS'}
          </Button>

          {result && (
            <button
              onClick={handleRun}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Re-run with current CV
            </button>
          )}
        </div>

        {/* History sidebar */}
        {!historyLoading && history.length > 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
            <h2 className="text-xs font-bold font-mono uppercase text-[var(--color-text-muted)]">Past Analyses</h2>
            <div className="flex flex-col gap-1">
              {history.map(h => (
                <button
                  key={h.id}
                  onClick={() => handleLoadHistory(h.id)}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors text-left ${result?.id === h.id ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20' : ''}`}
                >
                  <span className="flex items-center gap-2 text-[var(--color-text)]">
                    <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                    <span className="font-medium">{h.top_role ?? 'Career Analysis'}</span>
                    {h.top_pct != null && (
                      <span className="text-xs text-[var(--color-text-muted)]">· {h.top_pct}% match</span>
                    )}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] font-mono shrink-0 ml-4">
                    {new Date(h.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="py-16 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-[var(--color-primary)] mx-auto animate-pulse" />
            <p className="font-mono text-[var(--color-text-muted)] animate-pulse">Analyzing your background…</p>
            <p className="text-xs text-[var(--color-text-muted)]">This usually takes 15–30 seconds</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div id="career-match-results" className="space-y-8">

            {/* Career Identity */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold font-mono uppercase flex items-center gap-2 text-[var(--color-primary)]">
                <TrendingUp className="w-5 h-5" />
                Career Identity
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { label: 'Current', value: result.career_identity.current, color: 'text-[var(--color-text-muted)]' },
                  { label: 'Emerging', value: result.career_identity.emerging, color: 'text-[var(--color-accent)]' },
                  { label: 'Long-Term Potential', value: result.career_identity.long_term, color: 'text-[var(--color-primary)]' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[var(--color-bg)] rounded-lg p-4 space-y-1.5 border border-[var(--color-border)]">
                    <div className="text-xs font-mono uppercase text-[var(--color-text-muted)]">{label}</div>
                    <div className={`font-semibold text-sm ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Career Matches */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold font-mono uppercase text-[var(--color-primary)]">
                Top Career Matches
              </h2>
              <div className="space-y-4">
                {result.career_matches.map((match, i) => (
                  <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {i === 0 && <Star className="w-4 h-4 text-[var(--color-yellow-indicator)] fill-[var(--color-yellow-indicator)]" />}
                          <h3 className="text-lg font-bold text-[var(--color-text)]">{match.role}</h3>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-[var(--color-text-muted)]">
                          <span>{match.salary_range}</span>
                          <span>·</span>
                          <span>{match.growth_outlook} growth</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <DifficultyBadge level={match.transition_difficulty} />
                        <MatchPctRing pct={match.match_pct} />
                      </div>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border)] pt-3">
                      {match.why_you_match}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* LinkedIn Positioning */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-5">
              <h2 className="text-lg font-bold font-mono uppercase flex items-center gap-2 text-[var(--color-primary)]">
                <Link2 className="w-5 h-5" />
                LinkedIn Positioning
              </h2>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Optimized Headline</div>
                  <CopyButton text={result.linkedin.headline} label="COPY HEADLINE" />
                </div>
                <div className="p-4 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-lg text-sm font-medium text-[var(--color-text)]">
                  {result.linkedin.headline}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono uppercase text-[var(--color-text-muted)]">About Section</div>
                  <CopyButton text={result.linkedin.about} label="COPY ABOUT" />
                </div>
                <div className="p-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
                  {result.linkedin.about}
                </div>
              </div>
            </div>

            {/* Strengths & Gaps */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-5">
              <h2 className="text-lg font-bold font-mono uppercase text-[var(--color-primary)]">
                Strengths & Gaps
              </h2>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="text-xs font-mono uppercase text-[var(--color-green-indicator)]">Strongest Experiences</div>
                  <ul className="space-y-2">
                    {result.strengths_gaps.strongest.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                        <span className="text-[var(--color-green-indicator)] font-mono font-bold shrink-0 mt-0.5">+</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-mono uppercase text-[var(--color-yellow-indicator)]">Underutilized</div>
                  <ul className="space-y-2">
                    {result.strengths_gaps.underutilized.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                        <span className="text-[var(--color-yellow-indicator)] font-mono font-bold shrink-0 mt-0.5">~</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Missing Keywords</div>
                  <div className="flex flex-wrap gap-2">
                    {result.strengths_gaps.missing_keywords.map((kw, i) => (
                      <span key={i} className="text-xs font-mono px-2 py-1 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </Layout>
  );
}
