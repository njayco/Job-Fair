import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { getApplication, generatePdf, downloadBlob, scoreColor } from '../api';
import type { Application } from '../api';
import ReactMarkdown from 'react-markdown';
import { FileDown, LayoutDashboard, ChevronLeft, ArrowRight, ExternalLink } from 'lucide-react';

export default function ResultsPage() {
  const { id } = useParams();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      getApplication(Number(id))
        .then(setApp)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!app) return;
    setPdfLoading(true);
    try {
      const blob = await generatePdf({ application_id: app.id });
      downloadBlob(blob, `${app.company.replace(/\s+/g, '_')}_${app.role.replace(/\s+/g, '_')}_CareerOps.pdf`);
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const getRecommendationBadge = (rec: string) => {
    if (rec === 'APPLY') return <Badge variant="success" className="text-sm px-3 py-1">APPLY</Badge>;
    if (rec === 'CONSIDER') return <Badge variant="warning" className="text-sm px-3 py-1">CONSIDER</Badge>;
    if (rec === 'SKIP') return <Badge variant="danger" className="text-sm px-3 py-1">SKIP</Badge>;
    return <Badge>{rec}</Badge>;
  };

  const getScoreVariant = (score: string | null) => {
    const c = scoreColor(score);
    if (c === 'green') return 'success';
    if (c === 'yellow') return 'warning';
    if (c === 'red') return 'danger';
    return 'default';
  };

  if (loading) return <Layout><div className="py-24 text-center font-mono text-[var(--color-text-muted)] animate-pulse">Loading evaluation data...</div></Layout>;
  if (error || !app) return <Layout><div className="py-24 text-center font-mono text-[var(--color-red-indicator)]">Error: {error || 'Not found'}</div></Layout>;

  // Extract evaluation from report_preview or we'll just render markdown for now if no structured data is available
  // The API returns report_md which we can render fully.

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <Link to="/pipeline" className="inline-flex items-center text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Pipeline
        </Link>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold">{app.company}</h1>
                <Badge variant="outline" className="text-[var(--color-text-muted)]">{app.archetype || 'General'}</Badge>
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
                  'text-[var(--color-red-indicator)]'
                }`}>
                  {app.score || 'N/A'}
                </div>
              </div>
              <div className="h-12 w-px bg-[var(--color-border)]"></div>
              <div className="text-center flex flex-col items-center justify-center">
                <div className="text-xs font-mono text-[var(--color-text-muted)] uppercase mb-2">Verdict</div>
                {/* Fallback to checking score for verdict if not parsed easily */}
                {parseFloat(app.score || '0') >= 4.0 ? getRecommendationBadge('APPLY') : 
                 parseFloat(app.score || '0') >= 3.0 ? getRecommendationBadge('CONSIDER') : 
                 getRecommendationBadge('SKIP')}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-[var(--color-border)]">
            <Button onClick={handleDownloadPdf} disabled={pdfLoading} className="gap-2 font-mono" variant="primary">
              <FileDown className="w-4 h-4" />
              {pdfLoading ? 'GENERATING...' : 'DOWNLOAD PDF REPORT'}
            </Button>
            <Link to="/pipeline">
              <Button variant="secondary" className="gap-2 font-mono">
                <LayoutDashboard className="w-4 h-4" />
                VIEW IN PIPELINE
              </Button>
            </Link>
            <Link to={`/report/${app.id}`}>
              <Button variant="outline" className="gap-2 font-mono ml-auto">
                FULL REPORT VIEW <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {app.report_md && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 md:p-8 prose prose-invert max-w-none">
            <ReactMarkdown>{app.report_md}</ReactMarkdown>
          </div>
        )}
      </div>
    </Layout>
  );
}
