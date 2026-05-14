import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import CandidateTable from '../components/employer/CandidateTable';
import {
  createEmployerJob, getEmployerJob,
  uploadCandidates, evaluateCandidates,
} from '../api';
import type { EmployerJob, EmployerCandidate } from '../api';
import {
  Briefcase, Upload, X, Loader2, CheckCircle2,
  FileText, ChevronRight, Timer, RotateCcw, AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/button';

type Step = 'jd' | 'upload' | 'evaluating' | 'results';

const SENIORITY_OPTIONS = ['junior', 'mid', 'senior', 'principal'];
const REC_OPTIONS = ['Strong Hire', 'Hire', 'Consider', 'Weak Match', 'Do Not Proceed'];

export default function EmployerSearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: jobIdParam } = useParams<{ id?: string }>();

  // Step state — viewing existing job jumps straight to results
  const [step, setStep] = useState<Step>(jobIdParam ? 'results' : 'jd');
  const [job, setJob] = useState<EmployerJob | null>(null);
  const [candidates, setCandidates] = useState<EmployerCandidate[]>([]);

  // JD panel
  const [jdTitle, setJdTitle] = useState('');
  const [jdDepartment, setJdDepartment] = useState('');
  const [jdText, setJdText] = useState('');
  const [savingJd, setSavingJd] = useState(false);
  const [jdError, setJdError] = useState('');

  // Upload panel
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [parseErrors, setParseErrors] = useState<{ filename: string; error: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter state (results panel — client-side)
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [filterSeniority, setFilterSeniority] = useState<string[]>([]);
  const [filterRec, setFilterRec] = useState<string[]>([]);
  const [filterEmployer, setFilterEmployer] = useState('');

  // Evaluating state
  const [evalError, setEvalError] = useState('');
  const [evalSeconds, setEvalSeconds] = useState(0);
  const [evalTimerRef, setEvalTimerRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const [evalTime, setEvalTime] = useState(0);
  const [evalCount, setEvalCount] = useState(0);

  // Auth guard
  useEffect(() => {
    if (user && user.account_type !== 'employer') navigate('/', { replace: true });
  }, [user, navigate]);

  // Load existing job when viewing /employer/jobs/:id
  useEffect(() => {
    if (!jobIdParam) return;
    getEmployerJob(Number(jobIdParam))
      .then(data => {
        setJob(data.job);
        setCandidates(data.candidates);
        setStep('results');
      })
      .catch(() => navigate('/employer', { replace: true }));
  }, [jobIdParam, navigate]);

  // ── JD panel ────────────────────────────────────────────────────────────────
  const handleSaveJd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jdText.trim().length < 20) {
      setJdError('Please paste the full job description (at least 20 characters).');
      return;
    }
    setJdError('');
    setSavingJd(true);
    try {
      const newJob = await createEmployerJob({ title: jdTitle.trim() || undefined, department: jdDepartment.trim() || undefined, description_text: jdText.trim() });
      setJob(newJob);
      setStep('upload');
    } catch (err) {
      setJdError(err instanceof Error ? err.message : 'Failed to save job.');
    } finally {
      setSavingJd(false);
    }
  };

  // ── Upload panel ─────────────────────────────────────────────────────────────
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const allowed = arr.filter(f => /\.(pdf|docx|txt)$/i.test(f.name));
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      const fresh = allowed.filter(f => !names.has(f.name));
      return [...prev, ...fresh].slice(0, 20);
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleFindBestFit = async () => {
    if (!job || !files.length) return;
    setUploadError('');
    setUploading(true);
    setParseErrors([]);
    try {
      const uploadResult = await uploadCandidates(job.id, files);
      if (uploadResult.errors?.length) setParseErrors(uploadResult.errors);
      if (uploadResult.uploaded === 0) {
        setUploadError('No files could be parsed. Check that uploads are valid PDF/DOCX/TXT.');
        setUploading(false);
        return;
      }
      setEvalCount(uploadResult.uploaded);
      setUploading(false);
      setStep('evaluating');

      // Start timer
      const start = Date.now();
      const timer = setInterval(() => setEvalSeconds(Math.floor((Date.now() - start) / 1000)), 500);
      setEvalTimerRef(timer);

      try {
        const evalResult = await evaluateCandidates(job.id);
        clearInterval(timer);
        setEvalTime(Math.round((Date.now() - start) / 100) / 10);
        setCandidates(evalResult.candidates);
        setStep('results');
      } catch (err) {
        clearInterval(timer);
        setEvalError(err instanceof Error ? err.message : 'Evaluation failed.');
        setStep('upload');
      }
    } catch (err) {
      setUploading(false);
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  // Cleanup timer on unmount
  useEffect(() => () => { if (evalTimerRef) clearInterval(evalTimerRef); }, [evalTimerRef]);

  // Derived filtered candidates (client-side, no API calls)
  const filteredCandidates = candidates.filter(c => {
    if (filterMinScore > 0 && (c.match_score ?? 0) < filterMinScore) return false;
    if (filterSeniority.length && !filterSeniority.includes(c.seniority ?? '')) return false;
    if (filterRec.length && !filterRec.includes(c.recommendation ?? '')) return false;
    if (filterEmployer.trim() && !c.parsed_employer?.toLowerCase().includes(filterEmployer.toLowerCase())) return false;
    return true;
  });

  const resetSearch = () => {
    setStep('jd');
    setJob(null);
    setCandidates([]);
    setFiles([]);
    setJdTitle('');
    setJdDepartment('');
    setJdText('');
    setJdError('');
    setUploadError('');
    setEvalError('');
    setEvalSeconds(0);
    if (jobIdParam) navigate('/employer/search', { replace: true });
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Briefcase className="w-6 h-6 text-[var(--color-accent)]" />
              <h1 className="text-2xl font-bold font-mono">
                {step === 'results' && job ? job.title : 'New Candidate Search'}
              </h1>
            </div>
            {step !== 'jd' && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <span className={step === 'upload' || step === 'evaluating' || step === 'results' ? 'text-[var(--color-accent)]' : ''}>Job Saved</span>
                <ChevronRight className="w-3 h-3" />
                <span className={step === 'upload' || step === 'evaluating' ? 'text-[var(--color-accent)]' : step === 'results' ? '' : 'opacity-40'}>Upload</span>
                <ChevronRight className="w-3 h-3" />
                <span className={step === 'results' ? 'text-[var(--color-accent)]' : 'opacity-40'}>Results</span>
              </div>
            )}
          </div>
          {step === 'results' && (
            <Button variant="outline" onClick={resetSearch} className="gap-2 font-mono text-xs shrink-0">
              <RotateCcw className="w-3.5 h-3.5" />
              NEW SEARCH
            </Button>
          )}
        </div>

        {/* ── Step 1: JD Panel ── */}
        {step === 'jd' && (
          <form onSubmit={handleSaveJd} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold font-mono">Paste the Job Description</h2>
              <p className="text-sm text-[var(--color-text-muted)]">We'll use this to score every candidate's resume against the role.</p>
            </div>

            {jdError && (
              <div className="flex items-start gap-2 p-3 bg-[var(--color-red-indicator)]/10 border border-[var(--color-red-indicator)]/20 rounded text-[var(--color-red-indicator)] text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {jdError}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Job Title (optional)</label>
                <input
                  type="text"
                  value={jdTitle}
                  onChange={e => setJdTitle(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  disabled={savingJd}
                  className="w-full font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Department (optional)</label>
                <input
                  type="text"
                  value={jdDepartment}
                  onChange={e => setJdDepartment(e.target.value)}
                  placeholder="e.g. Engineering, Sales, Marketing"
                  disabled={savingJd}
                  className="w-full font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Job Description *</label>
              <textarea
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                placeholder="Paste the full job description here…"
                required
                disabled={savingJd}
                rows={14}
                className="w-full font-mono text-sm resize-y"
              />
            </div>
            <Button type="submit" variant="primary" size="lg" disabled={savingJd} className="font-mono gap-2">
              {savingJd ? <><Loader2 className="w-4 h-4 animate-spin" /> SAVING…</> : <>SAVE & CONTINUE <ChevronRight className="w-4 h-4" /></>}
            </Button>
          </form>
        )}

        {/* ── Step 2: Upload Panel ── */}
        {step === 'upload' && (
          <div className="space-y-6">
            {uploadError && (
              <div className="flex items-start gap-2 p-3 bg-[var(--color-red-indicator)]/10 border border-[var(--color-red-indicator)]/20 rounded text-[var(--color-red-indicator)] text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {uploadError}
              </div>
            )}
            {evalError && (
              <div className="flex items-start gap-2 p-3 bg-[var(--color-red-indicator)]/10 border border-[var(--color-red-indicator)]/20 rounded text-[var(--color-red-indicator)] text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {evalError}
              </div>
            )}

            {/* Per-file parse errors */}
            {parseErrors.length > 0 && (
              <div className="bg-[var(--color-yellow-indicator)]/5 border border-[var(--color-yellow-indicator)]/20 rounded-xl p-4 space-y-2">
                <p className="text-xs font-mono font-bold text-[var(--color-yellow-indicator)] uppercase">
                  {parseErrors.length} file{parseErrors.length !== 1 ? 's' : ''} could not be parsed
                </p>
                {parseErrors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                    <span className="font-mono shrink-0 text-[var(--color-yellow-indicator)]">×</span>
                    <span><span className="font-mono">{e.filename}</span> — {e.error}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragging
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface)]'
              }`}
            >
              <Upload className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-4" />
              <p className="text-lg font-medium text-[var(--color-text)]">Drop resumes here or click to browse</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">PDF, DOCX, TXT · up to 20 files · max 10 MB each</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={e => e.target.files && addFiles(e.target.files)}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
                <div className="px-4 py-2 text-xs font-mono text-[var(--color-text-muted)] uppercase">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </div>
                {files.map(f => (
                  <div key={f.name} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                      <span className="text-sm font-mono truncate">{f.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter(x => x.name !== f.name))}
                      className="p-1 rounded hover:bg-[var(--color-red-indicator)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-red-indicator)] transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              disabled={!files.length || uploading}
              onClick={handleFindBestFit}
              className="font-mono gap-2"
            >
              {uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> UPLOADING…</>
                : <><CheckCircle2 className="w-4 h-4" /> FIND BEST FIT ({files.length} resume{files.length !== 1 ? 's' : ''})</>}
            </Button>
          </div>
        )}

        {/* ── Step: Evaluating ── */}
        {step === 'evaluating' && (
          <div className="py-20 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <Loader2 className="w-20 h-20 text-[var(--color-accent)] animate-spin" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-mono">Evaluating {evalCount} candidate{evalCount !== 1 ? 's' : ''}…</h2>
              <p className="text-[var(--color-text-muted)]">Claude is scoring every resume against your job description.</p>
            </div>
            <div className="inline-flex items-center gap-2 font-mono text-[var(--color-accent)] text-lg">
              <Timer className="w-5 h-5" />
              {evalSeconds}s elapsed
            </div>
          </div>
        )}

        {/* ── Step 3: Results Panel ── */}
        {step === 'results' && (
          <div className="space-y-6">
            {/* Timing banner */}
            {evalTime > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 rounded-xl text-sm font-mono text-[var(--color-accent)]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} evaluated in {evalTime}s
              </div>
            )}

            {candidates.length === 0 ? (
              <div className="py-16 text-center space-y-4 border border-dashed border-[var(--color-border)] rounded-xl">
                <p className="text-[var(--color-text-muted)]">No candidates yet for this job.</p>
                <Link to="/employer/search">
                  <Button variant="primary" className="font-mono gap-2">
                    <Upload className="w-4 h-4" />
                    UPLOAD RESUMES
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {/* Filter bar */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Min score */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] flex items-center justify-between">
                        Min Score
                        <span className="text-[var(--color-accent)]">{filterMinScore > 0 ? filterMinScore : 'Any'}</span>
                      </label>
                      <input
                        type="range" min={0} max={100} step={5}
                        value={filterMinScore}
                        onChange={e => setFilterMinScore(Number(e.target.value))}
                        className="w-full accent-[var(--color-accent)] cursor-pointer"
                      />
                    </div>

                    {/* Employer search */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Current Employer</label>
                      <input
                        type="text"
                        value={filterEmployer}
                        onChange={e => setFilterEmployer(e.target.value)}
                        placeholder="Search employer…"
                        className="w-full font-mono text-xs"
                      />
                    </div>

                    {/* Seniority */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Seniority</label>
                      <div className="flex flex-wrap gap-1">
                        {SENIORITY_OPTIONS.map(s => (
                          <button
                            key={s}
                            onClick={() => setFilterSeniority(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors capitalize ${
                              filterSeniority.includes(s)
                                ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/50 text-[var(--color-accent)]'
                                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/30'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Recommendation</label>
                      <div className="flex flex-wrap gap-1">
                        {REC_OPTIONS.map(r => (
                          <button
                            key={r}
                            onClick={() => setFilterRec(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                              filterRec.includes(r)
                                ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/50 text-[var(--color-accent)]'
                                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/30'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Active filter summary */}
                  <div className="flex items-center justify-between text-xs font-mono text-[var(--color-text-muted)]">
                    <span>
                      {filteredCandidates.length} of {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} · ranked by fit
                    </span>
                    {(filterMinScore > 0 || filterSeniority.length || filterRec.length || filterEmployer) && (
                      <button
                        onClick={() => { setFilterMinScore(0); setFilterSeniority([]); setFilterRec([]); setFilterEmployer(''); }}
                        className="text-[var(--color-red-indicator)] hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>

                <CandidateTable
                  jobId={job?.id ?? Number(jobIdParam)}
                  candidates={filteredCandidates}
                  onCandidatesChange={updated => setCandidates(prev =>
                    prev.map(c => updated.find(u => u.id === c.id) ?? c)
                  )}
                />
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
