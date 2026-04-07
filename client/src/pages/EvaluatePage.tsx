import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { evaluate } from '../api';
import { FileText, Link as LinkIcon, Loader2, Zap } from 'lucide-react';

interface LimitError {
  code: string;
  usageCount: number;
  freeLimit: number;
}

export default function EvaluatePage() {
  const navigate = useNavigate();
  const [cvContent, setCvContent] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState('');
  const [limitError, setLimitError] = useState<LimitError | null>(null);
  const [activeTab, setActiveTab] = useState<'url' | 'desc'>('url');

  useEffect(() => {
    const savedCv = localStorage.getItem('career_ops_cv');
    if (savedCv) setCvContent(savedCv);
  }, []);

  const handleCvChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCvContent(val);
    localStorage.setItem('career_ops_cv', val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cvContent.trim()) { setError('CV content is required'); return; }
    if (activeTab === 'url' && !jobUrl.trim()) { setError('Job URL is required'); return; }
    if (activeTab === 'desc' && !jobDesc.trim()) { setError('Job Description is required'); return; }

    setIsEvaluating(true);
    setError('');
    setLimitError(null);

    try {
      const res = await evaluate({
        cv_content: cvContent,
        job_url: activeTab === 'url' ? jobUrl : undefined,
        job_description: activeTab === 'desc' ? jobDesc : undefined,
      });
      sessionStorage.setItem(`eval_${res.application_id}`, JSON.stringify(res));
      navigate(`/results/${res.application_id}`);
    } catch (e: any) {
      if (e?.code === 'LIMIT_REACHED') {
        setLimitError({ code: e.code, usageCount: e.usageCount, freeLimit: e.freeLimit });
      } else {
        setError(e instanceof Error ? e.message : 'Evaluation failed');
      }
      setIsEvaluating(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">New Evaluation</h1>
          <p className="text-[var(--color-text-muted)] mt-2">Analyze a job description against your CV to find the perfect fit.</p>
        </div>

        {limitError && (
          <div className="p-5 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/30 rounded-xl space-y-3">
            <div className="font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--color-primary)]" />
              Monthly limit reached
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              You've used all {limitError.freeLimit} free evaluations this month. Upgrade to Pro for unlimited access.
            </p>
            <Link to="/pricing">
              <Button size="sm" className="gap-2 font-mono">
                <Zap className="w-3 h-3" />
                UPGRADE TO PRO — $19/MONTH
              </Button>
            </Link>
          </div>
        )}

        {error && (
          <div className="p-4 bg-[var(--color-red-indicator)]/10 border border-[var(--color-red-indicator)]/20 rounded text-[var(--color-red-indicator)] font-mono text-sm">
            ERROR: {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--color-primary)]" />
                Your CV (Markdown)
              </h2>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">Auto-saved</span>
            </div>
            <textarea
              value={cvContent}
              onChange={handleCvChange}
              placeholder="# Jane Doe&#10;&#10;Senior AI Engineer..."
              className="w-full h-[60vh] font-mono text-sm resize-none bg-[var(--color-bg)]"
              disabled={isEvaluating}
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-[var(--color-accent)]" />
              Job Details
            </h2>

            <div className="flex space-x-2 border-b border-[var(--color-border)] mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`px-4 py-2 font-mono text-sm border-b-2 transition-colors ${activeTab === 'url' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('desc')}
                className={`px-4 py-2 font-mono text-sm border-b-2 transition-colors ${activeTab === 'desc' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
              >
                Paste Description
              </button>
            </div>

            {activeTab === 'url' ? (
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://boards.greenhouse.io/..."
                className="w-full font-mono text-sm"
                disabled={isEvaluating}
              />
            ) : (
              <textarea
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                placeholder="Paste the full job description here..."
                className="w-full h-[50vh] font-mono text-sm resize-none bg-[var(--color-bg)]"
                disabled={isEvaluating}
              />
            )}

            <div className="pt-4">
              <Button
                type="submit"
                size="lg"
                className="w-full font-mono text-lg"
                disabled={isEvaluating || !!limitError}
              >
                {isEvaluating ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" />ANALYZING...</>
                ) : 'EVALUATE FIT'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
