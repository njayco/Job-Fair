import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { getApplication, generatePdf, downloadBlob, scoreColor, updateApplicationStatus, reviseCv, getCv } from '../api';
import type { Application, Evaluation, EvaluateResponse, AppStatus } from '../api';
import ReactMarkdown from 'react-markdown';
import {
  FileDown, LayoutDashboard, ChevronLeft, ArrowRight, ExternalLink,
  CheckCircle2, AlertCircle, XCircle, TrendingUp, DollarSign, FileEdit, BookOpen,
  Sparkles, Copy, Download, Check, Code, Send,
} from 'lucide-react';

export default function ResultsPage() {
  const { id } = useParams();
  const [app, setApp] = useState<Application | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState<AppStatus | null>(null);
  const [error, setError] = useState('');
  const [revisedCv, setRevisedCv] = useState<string | null>(null);
  const [revising, setRevising] = useState(false);
  const [reviseError, setReviseError] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    const stored = localStorage.getItem(`eval_${id}`) || sessionStorage.getItem(`eval_${id}`);
    let evaluationFromStorage: Evaluation | null = null;
    if (stored) {
      try {
        const parsed: EvaluateResponse = JSON.parse(stored);
        evaluationFromStorage = parsed.evaluation;
        setEvaluation(evaluationFromStorage);
      } catch {
        // fall through to server-side evaluation_json
      }
    }
    getApplication(Number(id))
      .then(a => {
        setApp(a);
        setSavedStatus(a.status);
        if (!evaluationFromStorage && a.evaluation_json) {
          setEvaluation(a.evaluation_json);
        }
      })
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

  const handleReviseCv = async () => {
    if (!app || !evaluation) return;
    setRevising(true);
    setReviseError('');
    try {
      let cvContent = localStorage.getItem('career_ops_cv') || '';
      if (!cvContent.trim()) {
        try {
          const saved = await getCv();
          cvContent = saved.content_md || '';
        } catch {
          // ignore — handled below
        }
      }
      if (!cvContent.trim()) {
        throw new Error('Original CV not found. Please paste your CV on the Evaluate page first.');
      }
      const changes = evaluation.block_e?.cv_changes || [];
      if (changes.length === 0) {
        throw new Error('No CV change suggestions are available for this evaluation.');
      }
      const result = await reviseCv({
        cv_content: cvContent,
        cv_changes: changes,
        company: app.company,
        role: app.role,
      });
      setRevisedCv(result.revised_cv);
      setTimeout(() => {
        document.getElementById('revised-cv-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (e) {
      setReviseError(e instanceof Error ? e.message : 'Failed to revise CV');
    } finally {
      setRevising(false);
    }
  };

  const handleCopyRevised = async () => {
    if (!revisedCv) return;
    try {
      await navigator.clipboard.writeText(revisedCv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setReviseError('Could not copy to clipboard. Please select and copy manually.');
    }
  };

  const handleDownloadRevised = () => {
    if (!revisedCv || !app) return;
    const safe = (s: string) => s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${safe(app.company)}_${safe(app.role)}_Revised_CV.md`;
    const blob = new Blob([revisedCv], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, filename);
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
  const block_c = evaluation?.block_c;
  const block_d = evaluation?.block_d;
  const block_e = evaluation?.block_e;
  const block_f = evaluation?.block_f;

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

          {/* Recommendation Reason */}
          {evaluation?.recommendation_reason && (
            <p className="text-sm text-[var(--color-text-muted)]">{evaluation.recommendation_reason}</p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-[var(--color-border)]">
            <Button onClick={handleDownloadPdf} disabled={pdfLoading} className="gap-2 font-mono" variant="primary">
              <FileDown className="w-4 h-4" />
              {pdfLoading ? 'GENERATING...' : 'DOWNLOAD PDF'}
            </Button>
            {evaluation && (evaluation.block_e?.cv_changes?.length ?? 0) > 0 && (
              <Button
                onClick={handleReviseCv}
                disabled={revising}
                variant="accent"
                className="gap-2 font-mono"
              >
                <Sparkles className="w-4 h-4" />
                {revising ? 'REVISING...' : 'REVISE MY RESUME'}
              </Button>
            )}
            {savedStatus === 'Evaluated' ? (
              <Button
                onClick={() => handleSaveToPipeline('Applied')}
                disabled={saving}
                variant="secondary"
                className="gap-2 font-mono"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'SAVING...' : 'MARK AS APPLIED'}
              </Button>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-2 text-sm font-mono text-[var(--color-green-indicator)]">
                <CheckCircle2 className="w-4 h-4" />
                STATUS: {savedStatus}
              </span>
            )}
            <Link to="/pipeline">
              <Button variant="secondary" className="gap-2 font-mono">
                <LayoutDashboard className="w-4 h-4" />
                VIEW PIPELINE
              </Button>
            </Link>
            {app.url && (
              <Link to={`/apply/${app.id}`}>
                <Button variant="accent" className="gap-2 font-mono">
                  <Send className="w-4 h-4" />
                  ASSISTED APPLY
                </Button>
              </Link>
            )}
            <Link to={`/report/${app.id}`} className="ml-auto">
              <Button variant="outline" className="gap-2 font-mono">
                FULL REPORT <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Score Breakdown */}
        {evaluation?.score && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold font-mono uppercase text-[var(--color-text-muted)]">Score Breakdown</h2>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {(Object.entries(evaluation.score) as Array<[string, number]>).map(([key, val]) => (
                <div key={key} className="text-center">
                  <div className={`text-2xl font-bold font-mono ${
                    val >= 4 ? 'text-[var(--color-green-indicator)]' :
                    val >= 3 ? 'text-[var(--color-yellow-indicator)]' :
                    'text-[var(--color-red-indicator)]'
                  }`}>{val}</div>
                  <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase mt-1">{key.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Block A — Role Classification */}
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

        {/* Block B — CV Match & Gaps */}
        {block_b && (
          <div className="grid md:grid-cols-2 gap-6">
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

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold font-mono uppercase text-[var(--color-accent)]">B — Gaps</h2>
              {block_b.gaps.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No significant gaps identified.</p>
              ) : (
                <div className="space-y-3">
                  {block_b.gaps.map((g, i) => (
                    <div key={i} className="text-sm space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
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

        {/* Block C — Level & Seniority Strategy */}
        {block_c && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold font-mono uppercase flex items-center gap-2 text-[var(--color-primary)]">
              <TrendingUp className="w-5 h-5" />
              C — Level & Seniority Strategy
            </h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Role Level</div>
                <div className="text-[var(--color-text)]">{block_c.level_detected}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Your Level</div>
                <div className="text-[var(--color-text)]">{block_c.candidate_level}</div>
              </div>
            </div>
            {block_c.senior_pitch && (
              <div className="space-y-1">
                <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Senior Pitch</div>
                <p className="text-sm text-[var(--color-text)]">{block_c.senior_pitch}</p>
              </div>
            )}
            {block_c.downlevel_plan && (
              <div className="space-y-1">
                <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Downlevel Plan</div>
                <p className="text-sm text-[var(--color-text)]">{block_c.downlevel_plan}</p>
              </div>
            )}
          </div>
        )}

        {/* Block D — Compensation Analysis */}
        {block_d && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold font-mono uppercase flex items-center gap-2 text-[var(--color-primary)]">
              <DollarSign className="w-5 h-5" />
              D — Compensation Analysis
            </h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--color-border)]">
                {([
                  ['Salary Range', block_d.salary_range],
                  ['Market Position', block_d.market_position],
                  ['Company Comp', block_d.company_comp_reputation],
                  ['Demand Trend', block_d.demand_trend],
                ] as Array<[string, string]>).map(([label, value]) => (
                  <tr key={label}>
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--color-text-muted)] uppercase w-40">{label}</td>
                    <td className="py-2 text-[var(--color-text)]">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Block E — CV & LinkedIn Changes */}
        {block_e && (block_e.cv_changes.length > 0 || block_e.linkedin_changes.length > 0) && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-bold font-mono uppercase flex items-center gap-2 text-[var(--color-primary)]">
              <FileEdit className="w-5 h-5" />
              E — CV & LinkedIn Tailoring
            </h2>

            {block_e.cv_changes.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-mono uppercase text-[var(--color-text-muted)]">CV Changes</h3>
                <div className="space-y-4">
                  {block_e.cv_changes.map((c, i) => (
                    <div key={i} className="text-sm space-y-2 pb-4 border-b border-[var(--color-border)] last:border-0">
                      <div className="font-medium text-[var(--color-text)] font-mono">{c.section}</div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-[var(--color-red-indicator)]/5 rounded p-2">
                          <div className="text-xs font-mono text-[var(--color-text-muted)] mb-1">CURRENT</div>
                          <p className="text-[var(--color-text-muted)]">{c.current}</p>
                        </div>
                        <div className="bg-[var(--color-green-indicator)]/5 rounded p-2">
                          <div className="text-xs font-mono text-[var(--color-text-muted)] mb-1">PROPOSED</div>
                          <p className="text-[var(--color-text)]">{c.proposed}</p>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] italic">{c.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {block_e.linkedin_changes.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-mono uppercase text-[var(--color-text-muted)]">LinkedIn Changes</h3>
                <div className="space-y-3">
                  {block_e.linkedin_changes.map((c, i) => (
                    <div key={i} className="text-sm space-y-1 pb-3 border-b border-[var(--color-border)] last:border-0">
                      <div className="font-medium text-[var(--color-text)] font-mono">{c.section}</div>
                      <p className="text-[var(--color-text-muted)]">{c.change}</p>
                      <p className="text-xs text-[var(--color-text-muted)] italic">{c.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Block F — Interview Prep */}
        {block_f && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-bold font-mono uppercase flex items-center gap-2 text-[var(--color-primary)]">
              <BookOpen className="w-5 h-5" />
              F — Interview Preparation
            </h2>

            {block_f.recommended_case_study && (
              <div className="p-3 bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 rounded-lg">
                <div className="text-xs font-mono text-[var(--color-accent)] uppercase mb-1">Recommended Case Study</div>
                <p className="text-sm text-[var(--color-text)]">{block_f.recommended_case_study}</p>
              </div>
            )}

            {block_f.star_stories.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-mono uppercase text-[var(--color-text-muted)]">STAR Stories</h3>
                <div className="space-y-6">
                  {block_f.star_stories.map((s, i) => (
                    <div key={i} className="space-y-3 pb-6 border-b border-[var(--color-border)] last:border-0">
                      <div className="font-medium text-[var(--color-text)]">{s.requirement}</div>
                      {s.story && <p className="text-sm text-[var(--color-text-muted)]">{s.story}</p>}
                      <div className="grid md:grid-cols-2 gap-3 text-xs">
                        {(['situation', 'task', 'action', 'result'] as const).map(key => (
                          s[key] ? (
                            <div key={key} className="space-y-1">
                              <div className="font-mono text-[var(--color-text-muted)] uppercase">{key}</div>
                              <p className="text-[var(--color-text)]">{s[key]}</p>
                            </div>
                          ) : null
                        ))}
                      </div>
                      {s.reflection && (
                        <p className="text-xs text-[var(--color-text-muted)] italic">{s.reflection}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {block_f.red_flag_questions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-mono uppercase text-[var(--color-text-muted)]">Red Flag Questions</h3>
                <div className="space-y-4">
                  {block_f.red_flag_questions.map((q, i) => (
                    <div key={i} className="space-y-2 pb-4 border-b border-[var(--color-border)] last:border-0">
                      <div className="text-sm font-medium text-[var(--color-yellow-indicator)] flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {q.question}
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] ml-6">{q.response}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Revise CV — error inline */}
        {reviseError && (
          <div className="p-4 bg-[var(--color-red-indicator)]/10 border border-[var(--color-red-indicator)]/20 rounded-lg text-[var(--color-red-indicator)] font-mono text-sm">
            ERROR: {reviseError}
          </div>
        )}

        {/* Revised CV display */}
        {revisedCv && (
          <div
            id="revised-cv-section"
            className="bg-[var(--color-surface)] border-2 border-[var(--color-accent)]/40 rounded-xl p-6 md:p-8 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold font-mono uppercase flex items-center gap-2 text-[var(--color-accent)]">
                  <Sparkles className="w-5 h-5" />
                  Your Revised Resume
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Tailored for {app.role} at {app.company}. Review before sending.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCopyRevised} variant="secondary" size="sm" className="gap-2 font-mono">
                  {copied ? <Check className="w-4 h-4 text-[var(--color-green-indicator)]" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'COPIED' : 'COPY'}
                </Button>
                <Button onClick={handleDownloadRevised} variant="secondary" size="sm" className="gap-2 font-mono">
                  <Download className="w-4 h-4" />
                  DOWNLOAD .MD
                </Button>
                <Button onClick={() => setShowSource(s => !s)} variant="ghost" size="sm" className="gap-2 font-mono">
                  <Code className="w-4 h-4" />
                  {showSource ? 'PREVIEW' : 'SOURCE'}
                </Button>
              </div>
            </div>

            {showSource ? (
              <pre className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 text-xs font-mono text-[var(--color-text)] overflow-auto max-h-[70vh] whitespace-pre-wrap">
{revisedCv}
              </pre>
            ) : (
              <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-6 prose prose-invert prose-sm max-w-none overflow-auto max-h-[70vh]">
                <ReactMarkdown>{revisedCv}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Full Report Markdown fallback when no structured data available */}
        {!evaluation && app.report_md && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 md:p-8 prose prose-invert max-w-none">
            <ReactMarkdown>{app.report_md}</ReactMarkdown>
          </div>
        )}
      </div>
    </Layout>
  );
}
