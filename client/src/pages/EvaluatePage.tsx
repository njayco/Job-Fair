import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { evaluate } from '../api';
import { FileText, Link as LinkIcon } from 'lucide-react';

const PROGRESS_STAGES = [
  { at: 0,  label: 'Initializing evaluation...' },
  { at: 8,  label: 'Fetching job description...' },
  { at: 22, label: 'Parsing CV content...' },
  { at: 35, label: 'Matching skills to requirements...' },
  { at: 50, label: 'Running AI analysis...' },
  { at: 65, label: 'Scoring competency gaps...' },
  { at: 78, label: 'Generating interview prep...' },
  { at: 88, label: 'Compiling report...' },
  { at: 95, label: 'Finalizing results...' },
];

function useProgress(active: boolean) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
      return;
    }

    // Eased progress: fast early, very slow near 95%
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000; // seconds

      // Curve: approaches 95 asymptotically over ~40s
      const target = 95 * (1 - Math.exp(-elapsed / 14));
      setProgress(Math.min(target, 95));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active]);

  const complete = () => setProgress(100);

  return { progress, complete };
}

export default function EvaluatePage() {
  const navigate = useNavigate();
  const [cvContent, setCvContent] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'url' | 'desc'>('url');
  const { progress, complete } = useProgress(isEvaluating);

  const currentStage = [...PROGRESS_STAGES].reverse().find(s => progress >= s.at) ?? PROGRESS_STAGES[0];

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

    try {
      const res = await evaluate({
        cv_content: cvContent,
        job_url: activeTab === 'url' ? jobUrl : undefined,
        job_description: activeTab === 'desc' ? jobDesc : undefined,
      });
      complete();
      await new Promise(r => setTimeout(r, 400));
      sessionStorage.setItem(`eval_${res.application_id}`, JSON.stringify(res));
      navigate(`/results/${res.application_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluation failed');
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

        {error && (
          <div className="p-4 bg-[var(--color-red-indicator)]/10 border border-[var(--color-red-indicator)]/20 rounded text-[var(--color-red-indicator)] font-mono text-sm">
            ERROR: {error}
          </div>
        )}

        {isEvaluating && (
          <div className="p-6 border border-[var(--color-border)] rounded bg-[var(--color-surface)] space-y-4">
            <div className="flex items-center justify-between font-mono text-sm">
              <span className="text-[var(--color-primary)]">{currentStage.label}</span>
              <span className="text-[var(--color-text-muted)]">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-[var(--color-text-muted)] font-mono">
              This usually takes 20–40 seconds. You can paste the job description instead to skip URL fetching.
            </p>
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
                disabled={isEvaluating}
              >
                {isEvaluating ? 'ANALYZING...' : 'EVALUATE FIT'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
