import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { getApplication, generatePdf, downloadBlob, scoreColor, updateApplicationStatus } from '../api';
import type { Application, Evaluation, EvaluateResponse, AppStatus } from '../api';
import ReactMarkdown from 'react-markdown';
import { FileDown, LayoutDashboard, ChevronLeft, ArrowRight, ExternalLink, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

export default function ResultsPage() {
  const { id } = useParams();
  const [app, setApp] = useState<Application | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState<AppStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const stored = sessionStorage.getItem(`eval_${id}`);
    if (stored) {
      try {
        const parsed: EvaluateResponse = JSON.parse(stored);
        setEvaluation(parsed.evaluation);
      } catch {
        // fall through to markdown display
      }
    }
    getApplication(Number(id))
      .then(a => { setApp(a); setSavedStatus(a.status); })
      .catch(e => setError(e instanceof Error ? e.message : 'Not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!app) return;
    setPdfLoading(true);
    try {
      const blob = await generatePdf({ application_id: app.id });
      downloadBlob(blob, `${app.company.replace(/\s+/g, '_')}_${app.role.replace(/\s+/g, '_')}_CareerOps.pdf`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to download PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSaveToPipeline = async (status: AppStatus) => {
    if (!app) return;
    setSaving(true);
    try {
      await updateApplicationStatus(app.id, status);
      setSavedStatus(status);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const getRecommendationBadge = (rec: string) => {
    if (rec === 'APPLY') return <Badge variant="success" className="text-sm px-3 py-1">APPLY</Badge>;
    if (rec === 'CONSIDER') return <Badge variant="warning" className="text-sm px-3 py-1">CONSIDER</Badge>;
    if (rec === 'SKIP') return <Badge variant="danger" className="text-sm px-3 py-1">SKIP</Badge>;
    return <Badge>{rec}</Badge>;
  };

  const strengthIcon = (s: string) => {
    if (s === 'strong') return <CheckCircle2 className="w-4 h-4 text-[var(--color-green-indicator)] shrink-0" />;
    if (s === 'partial') return <AlertCircle className="w-4 h-4 text-[var(--color-yellow-indicator)] shrink-0" />;
    return <XCircle className="w-4 h-4 text-[var(--color-red-indicator)] shrink-0" />;
  };

  if (loading) return <Layout><div className="py-24 text-center font-mono text-[var(--color-text-muted)] animate-pulse">Loading evaluation data...</div></Layout>;
  if (error || !app) return <Layout><div className="py-24 text-center font-mono text-[var(--color-red-indicator)]">Error: {error || 'Not found'}</div></Layout>;

  const scoreNum = parseFloat(app.score ?? '0');
  const recommendation = scoreNum >= 4.0 ? 'APPLY' : scoreNum >= 3.0 ? 'CONSIDER' : 'SKIP';
  const block_a = evaluation?.block_a;
  const block_b = evaluation?.block_b;

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <Link to="/pipeline" className="inline-flex items-center text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Pipeline
        </Link>

        {/* Header Card */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold">{app.company}</h1>
                {app.archetype && <Badge variant="outline" className="text-[var(--color-text-muted)]">{app.archetype}</Badge>}
                {app.remote && <Badge variant="accent">{app.remote}</Badge>}
              </div>
              <div className="text-xl text-[var(--color-text-muted)] flex items-center gap-2">
                {app.role}
                {app.url && (
                  <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)]">
              <div className="text-center">
                <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1">Match Score</div>
                <div className={`text-4xl font-bold tracking-tighter ${
                  scoreColor(app.score) === 'green' ? 'text-[var(--color-green-indicator)]' :
                  scoreColor(app.score) === 'yellow' ? 'text-[var(--color-yellow-indicator)]' :
                  scoreColor(app.score) === 'red' ? 'text-[var(--color-red-indicator)]' :
                  'text-[var(--color-text-muted)]'
                }`}>
                  {app.score || 'N/A'}
                </div>
              </div>
              <div className="h-12 w-px bg-[var(--color-border)]"></div>
              <div className="text-center flex flex-col items-center justify-center">
                <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase mb-2">Verdict</div>
                {getRecommendationBadge(evaluation?.recommendation ?? recommendation)}
              </div>
            </div>
          </div>

          {/* TL;DR */}
          {app.tldr && (
            <div className="p-4 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-lg">
              <div className="text-xs font-mono text-[var(--color-primary)] uppercase mb-1">TL;DR</div>
              <p className="text-sm text-[var(--color-text)]">{app.tldr}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-[var(--color-border)]">
            <Button onClick={handleDownloadPdf} disabled={pdfLoading} className="gap-2 font-mono" variant="primary">
              <FileDown className="w-4 h-4" />
              {pdfLoading ? 'GENERATING...' : 'DOWNLOAD PDF'}
            </Button>
            {savedStatus === 'Evaluated' ? (
              <Button
                onClick={() => handleSaveToPipeline('Applied')}
                disabled={saving}
                variant="secondary"
                className="gap-2 font-mono"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'SAVING...' : 'SAVE TO PIPELINE'}
              </Button>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-2 text-sm font-mono text-[var(--color-green-indicator)]">
                <CheckCircle2 className="w-4 h-4" />
                SAVED: {savedStatus}
              </span>
            )}
            <Link to="/pipeline">
              <Button variant="secondary" className="gap-2 font-mono">
                <LayoutDashboard className="w-4 h-4" />
                VIEW PIPELINE
              </Button>
            </Link>
            <Link to={`/report/${app.id}`} className="ml-auto">
              <Button variant="outline" className="gap-2 font-mono">
                FULL REPORT <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Role Summary (Block A) */}
        {block_a && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold font-mono uppercase text-[var(--color-primary)]">A — Role Classification</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--color-border)]">
                {([
                  ['Archetype', block_a.archetype],
                  ['Domain', block_a.domain],
                  ['Function', block_a.function],
                  ['Seniority', block_a.seniority],
                  ['Remote Policy', block_a.remote],
                  block_a.team_size ? ['Team Size', block_a.team_size] : null,
                ] as Array<[string, string] | null>).filter((r): r is [string, string] => r !== null).map(([label, value]) => (
                  <tr key={label}>
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--color-text-muted)] uppercase w-40">{label}</td>
                    <td className="py-2 text-[var(--color-text)]">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {block_a.tldr && (
              <p className="text-sm text-[var(--color-text-muted)] italic border-t border-[var(--color-border)] pt-3">{block_a.tldr}</p>
            )}
          </div>
        )}

        {/* CV Match & Gaps (Block B) */}
        {block_b && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Matches */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold font-mono uppercase text-[var(--color-primary)]">B — CV Match</h2>
              <div className="space-y-3">
                {block_b.matches.map((m, i) => (
                  <div key={i} className="flex gap-3 items-start text-sm">
                    {strengthIcon(m.strength)}
                    <div>
                      <div className="font-medium text-[var(--color-text)]">{m.requirement}</div>
                      <div className="text-[var(--color-text-muted)] text-xs mt-0.5">{m.cv_match}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gaps */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold font-mono uppercase text-[var(--color-accent)]">B — Gaps</h2>
              {block_b.gaps.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No significant gaps identified.</p>
              ) : (
                <div className="space-y-3">
                  {block_b.gaps.map((g, i) => (
                    <div key={i} className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        {g.severity === 'blocker'
                          ? <XCircle className="w-4 h-4 text-[var(--color-red-indicator)] shrink-0" />
                          : <AlertCircle className="w-4 h-4 text-[var(--color-yellow-indicator)] shrink-0" />}
                        <span className="font-medium text-[var(--color-text)]">{g.gap}</span>
                        <Badge variant={g.severity === 'blocker' ? 'danger' : 'warning'} className="text-xs">{g.severity}</Badge>
                      </div>
                      <p className="text-[var(--color-text-muted)] text-xs ml-6">{g.mitigation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Score Breakdown */}
        {evaluation?.score && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold font-mono uppercase text-[var(--color-text-muted)]">Score Breakdown</h2>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {(Object.entries(evaluation.score) as Array<[string, number]>).map(([key, val]) => (
                <div key={key} className="text-center">
                  <div className={`text-2xl font-bold font-mono ${
                    val >= 4 ? 'text-[var(--color-green-indicator)]' :
                    val >= 3 ? 'text-[var(--color-yellow-indicator)]' :
                    'text-[var(--color-red-indicator)]'
                  }`}>{val}</div>
                  <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase mt-1">{key.replace('_', ' ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation Reason */}
        {evaluation?.recommendation_reason && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-2">
            <h2 className="text-lg font-bold font-mono uppercase text-[var(--color-text-muted)]">Recommendation</h2>
            <p className="text-sm text-[var(--color-text)]">{evaluation.recommendation_reason}</p>
          </div>
        )}

        {/* Full Report Markdown fallback (when no structured data) */}
        {!evaluation && app.report_md && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 md:p-8 prose prose-invert max-w-none">
            <ReactMarkdown>{app.report_md}</ReactMarkdown>
          </div>
        )}
      </div>
    </Layout>
  );
}
