import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import {
  getScannerCompanies, addScannerCompany, updateScannerCompany, deleteScannerCompany,
  getScannerConfig, updateScannerConfig, runScanner, getScannerRuns, getScannerRun,
  resetScannerHistory,
} from '../api';
import type {
  ScannerCompany, ScannerConfig, ScannerJobResult, ScannerRun, ScannerRunSummary, ScannerApiType,
} from '../api';
import {
  Radar, Play, Building2, Clock, AlertCircle, ExternalLink,
  ChevronRight, RotateCcw, Trash2, Plus, X, CheckCircle, Globe, Tags,
} from 'lucide-react';

// ── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  tags, onChange, placeholder, colorClass,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder: string;
  colorClass: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {tags.map(tag => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg border ${colorClass}`}
          >
            {tag}
            <button onClick={() => onChange(tags.filter(t => t !== tag))} className="opacity-60 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm font-mono text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
        <button
          onClick={add}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job, onEvaluate }: { job: ScannerJobResult; onEvaluate: (j: ScannerJobResult) => void }) {
  const typeLabel: Record<ScannerApiType, string> = {
    greenhouse: 'Greenhouse',
    greenhouse_eu: 'Greenhouse EU',
    ashby: 'Ashby',
    lever: 'Lever',
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-primary)]/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-[var(--color-text)] leading-snug truncate">{job.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-sm font-medium text-[var(--color-primary)]">{job.company}</span>
                {job.location && (
                  <>
                    <span className="text-[var(--color-border)]">·</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{job.location}</span>
                  </>
                )}
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                  {typeLabel[job.api_type] ?? job.api_type}
                </span>
              </div>
            </div>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
              title="View job posting"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors truncate max-w-[220px]"
            >
              {job.url.replace(/^https?:\/\//, '').slice(0, 70)}
            </a>
            <Button variant="outline" onClick={() => onEvaluate(job)} className="font-mono text-xs gap-1.5 shrink-0 ml-3">
              Evaluate Fit
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── API type badge helper ─────────────────────────────────────────────────────

const API_TYPE_LABELS: Record<ScannerApiType, string> = {
  greenhouse: 'Greenhouse',
  greenhouse_eu: 'Greenhouse EU',
  ashby: 'Ashby',
  lever: 'Lever',
};

const API_TYPES: ScannerApiType[] = ['greenhouse', 'greenhouse_eu', 'ashby', 'lever'];

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'results' | 'companies' | 'keywords';

export default function ScannerPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('results');

  // Scanner state
  const [run, setRun] = useState<ScannerRun | null>(null);
  const [runs, setRuns] = useState<ScannerRunSummary[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  // Companies
  const [companies, setCompanies] = useState<ScannerCompany[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companySearch, setCompanySearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', api_type: 'greenhouse' as ScannerApiType, api_slug: '' });
  const [addError, setAddError] = useState('');

  // Keywords
  const [config, setConfig] = useState<ScannerConfig | null>(null);
  const [posKws, setPosKws] = useState<string[]>([]);
  const [negKws, setNegKws] = useState<string[]>([]);
  const [kwSaving, setKwSaving] = useState(false);
  const [kwSaved, setKwSaved] = useState(false);

  // History
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loadingRunId, setLoadingRunId] = useState<number | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const loadData = useCallback(async () => {
    setCompaniesLoading(true);
    setHistoryLoading(true);
    try {
      const [compData, cfgData, runsData] = await Promise.all([
        getScannerCompanies(),
        getScannerConfig(),
        getScannerRuns(),
      ]);
      setCompanies(compData.companies);
      setConfig(cfgData);
      setPosKws(cfgData.keywords_positive);
      setNegKws(cfgData.keywords_negative);
      setRuns(runsData.runs);
    } catch (e) {
      console.error('Scanner load error:', e);
    } finally {
      setCompaniesLoading(false);
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Scan action ─────────────────────────────────────────────────────────────

  const handleScan = async () => {
    setScanning(true);
    setScanError('');
    setRun(null);
    setTab('results');
    try {
      const result = await runScanner();
      setRun(result);
      setRuns(prev => [{
        id: result.run_id,
        companies_scanned: result.companies_scanned,
        total_fetched: result.total_fetched,
        new_found: result.new_found,
        created_at: result.created_at,
      }, ...prev]);
      setTimeout(() => {
        document.getElementById('scanner-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleLoadRun = async (id: number) => {
    setLoadingRunId(id);
    setScanError('');
    try {
      const data = await getScannerRun(id);
      setRun({
        run_id: data.id ?? id,
        companies_scanned: data.companies_scanned,
        total_fetched: data.total_fetched,
        new_found: data.new_found,
        results: data.results_json ?? data.results ?? [],
        created_at: data.created_at,
      });
      setTab('results');
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Failed to load run.');
    } finally {
      setLoadingRunId(null);
    }
  };

  // ── Evaluate action ─────────────────────────────────────────────────────────

  const handleEvaluate = (job: ScannerJobResult) => {
    const jobDescription = [
      `${job.title} at ${job.company}`,
      job.location ? `Location: ${job.location}` : '',
      '',
      'This position was discovered via the Portal Scanner.',
      'Paste the full job description below before evaluating for best results.',
    ].filter(Boolean).join('\n');

    navigate('/evaluate', {
      state: {
        jobTitle: `${job.title} at ${job.company}`,
        jobDescription,
        jobUrl: job.url,
      },
    });
  };

  // ── Company actions ─────────────────────────────────────────────────────────

  const handleToggle = async (company: ScannerCompany) => {
    try {
      const updated = await updateScannerCompany(company.id, { enabled: !company.enabled });
      setCompanies(prev => prev.map(c => c.id === company.id ? updated : c));
    } catch (e) {
      console.error('Toggle failed:', e);
    }
  };

  const handleDeleteCompany = async (id: number) => {
    try {
      await deleteScannerCompany(id);
      setCompanies(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleAddCompany = async () => {
    setAddError('');
    if (!newCompany.name.trim() || !newCompany.api_slug.trim()) {
      setAddError('Name and slug are required.');
      return;
    }
    try {
      const added = await addScannerCompany(newCompany);
      setCompanies(prev => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCompany({ name: '', api_type: 'greenhouse', api_slug: '' });
      setShowAddForm(false);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed to add company.');
    }
  };

  // ── Keyword actions ─────────────────────────────────────────────────────────

  const handleSaveKeywords = async () => {
    setKwSaving(true);
    setKwSaved(false);
    try {
      const saved = await updateScannerConfig({ keywords_positive: posKws, keywords_negative: negKws });
      setConfig(saved);
      setKwSaved(true);
      setTimeout(() => setKwSaved(false), 2000);
    } catch (e) {
      console.error('Keyword save failed:', e);
    } finally {
      setKwSaving(false);
    }
  };

  // ── Reset history ───────────────────────────────────────────────────────────

  const handleReset = async () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    try {
      await resetScannerHistory();
      setRuns([]);
      setRun(null);
      setResetConfirm(false);
    } catch (e) {
      console.error('Reset failed:', e);
    }
  };

  // ── Filtered companies ──────────────────────────────────────────────────────

  const filteredCompanies = companySearch
    ? companies.filter(c =>
        c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
        c.api_slug.toLowerCase().includes(companySearch.toLowerCase())
      )
    : companies;

  const enabledCount = companies.filter(c => c.enabled).length;
  const lastRun = runs[0];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Radar className="w-7 h-7 text-[var(--color-primary)]" />
            <h1 className="text-3xl font-bold font-mono tracking-tight">Portal Scanner</h1>
          </div>
          <p className="text-[var(--color-text-muted)] max-w-2xl">
            Monitors {companies.length || '45+'} company job portals (Greenhouse, Ashby, Lever) and surfaces new openings that match your keywords — so you never miss a fresh posting.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Companies', value: companies.length || '—', sub: `${enabledCount} enabled` },
            { label: 'Last Run', value: lastRun ? new Date(lastRun.created_at).toLocaleDateString() : '—', sub: lastRun ? `${lastRun.new_found} new` : 'never' },
            { label: 'Total Runs', value: runs.length, sub: 'scans completed' },
            { label: 'Keywords', value: (config?.keywords_positive.length ?? 0), sub: 'positive filters' },
          ].map(s => (
            <div key={s.label} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
              <div className="text-2xl font-bold font-mono text-[var(--color-text)]">{s.value}</div>
              <div className="text-xs font-mono uppercase text-[var(--color-text-muted)] mt-0.5">{s.label}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5 opacity-70">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Run button */}
        <div className="flex flex-wrap items-center gap-4">
          <Button
            onClick={handleScan}
            disabled={scanning}
            variant="primary"
            className="gap-2 font-mono"
          >
            <Play className="w-4 h-4" />
            {scanning ? 'SCANNING PORTALS…' : 'RUN SCANNER'}
          </Button>
          {scanning && (
            <p className="text-sm font-mono text-[var(--color-text-muted)] animate-pulse">
              Querying {enabledCount} companies — this takes ~15 seconds…
            </p>
          )}
          {resetConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-accent)]">Reset seen-URL history?</span>
              <button onClick={handleReset} className="text-xs font-mono text-[var(--color-red-indicator)] hover:underline">Yes, reset</button>
              <button onClick={() => setResetConfirm(false)} className="text-xs font-mono text-[var(--color-text-muted)] hover:underline">Cancel</button>
            </div>
          ) : runs.length > 0 && (
            <button
              onClick={() => setResetConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset seen history
            </button>
          )}
        </div>

        {/* Error */}
        {scanError && (
          <div className="p-4 bg-[var(--color-red-indicator)]/5 border border-[var(--color-red-indicator)]/30 rounded-xl flex items-start gap-3 text-sm text-[var(--color-red-indicator)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {scanError}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-[var(--color-border)]">
          <nav className="flex gap-1 -mb-px">
            {([
              { key: 'results', icon: Radar, label: 'Results' },
              { key: 'companies', icon: Building2, label: `Companies (${enabledCount}/${companies.length})` },
              { key: 'keywords', icon: Tags, label: 'Keywords' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as Tab)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-mono border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Results tab ── */}
        {tab === 'results' && (
          <div id="scanner-results" className="space-y-6">
            {/* Run results */}
            {run && !scanning && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold font-mono text-[var(--color-primary)]">
                      {run.new_found} New {run.new_found === 1 ? 'Job' : 'Jobs'} Found
                    </h2>
                    <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
                      Scanned {run.companies_scanned} companies · {run.total_fetched} total postings fetched · {new Date(run.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {run.results.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <CheckCircle className="w-10 h-10 text-[var(--color-green-indicator)] mx-auto opacity-60" />
                    <p className="font-mono text-[var(--color-text-muted)]">No new matching jobs since last scan.</p>
                    <p className="text-xs text-[var(--color-text-muted)]">All current openings were already seen. Run again later or adjust keywords.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {run.results.map((job, i) => (
                      <JobCard key={`${job.url}-${i}`} job={job} onEvaluate={handleEvaluate} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {!run && !scanning && (
              <div className="py-16 text-center space-y-3">
                <Radar className="w-10 h-10 text-[var(--color-primary)] mx-auto opacity-40" />
                <p className="font-mono text-[var(--color-text-muted)]">Run the scanner to see new job openings.</p>
                <p className="text-xs text-[var(--color-text-muted)]">New postings since your last scan will appear here.</p>
              </div>
            )}

            {/* History sidebar */}
            {!historyLoading && runs.length > 0 && (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold font-mono uppercase text-[var(--color-text-muted)]">
                  <Clock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                  Scan History
                </h3>
                <div className="flex flex-col gap-1">
                  {runs.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleLoadRun(r.id)}
                      disabled={loadingRunId === r.id}
                      className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors text-left ${run?.run_id === r.id ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20' : ''}`}
                    >
                      <span className="flex items-center gap-2 text-[var(--color-text)]">
                        <span className="font-medium">{r.new_found} new jobs</span>
                        <span className="text-xs text-[var(--color-text-muted)]">· {r.companies_scanned} companies</span>
                        <span className="text-xs text-[var(--color-text-muted)]">· {r.total_fetched} fetched</span>
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] font-mono shrink-0 ml-4">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Companies tab ── */}
        {tab === 'companies' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={companySearch}
                onChange={e => setCompanySearch(e.target.value)}
                placeholder="Filter companies…"
                className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors w-56"
              />
              <div className="flex gap-1.5 ml-auto">
                <button
                  onClick={() => {
                    const ids = filteredCompanies.filter(c => !c.enabled).map(c => c.id);
                    ids.forEach(id => handleToggle(companies.find(c => c.id === id)!));
                  }}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                  Enable All
                </button>
                <button
                  onClick={() => {
                    const toDisable = filteredCompanies.filter(c => c.enabled);
                    toDisable.forEach(c => handleToggle(c));
                  }}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                >
                  Disable All
                </button>
                <button
                  onClick={() => setShowAddForm(v => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border border-[var(--color-primary)]/40 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Company
                </button>
              </div>
            </div>

            {/* Add company form */}
            {showAddForm && (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold font-mono uppercase text-[var(--color-text)]">Add Company</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newCompany.name}
                    onChange={e => setNewCompany(p => ({ ...p, name: e.target.value }))}
                    placeholder="Company name"
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                  />
                  <select
                    value={newCompany.api_type}
                    onChange={e => setNewCompany(p => ({ ...p, api_type: e.target.value as ScannerApiType }))}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                  >
                    {API_TYPES.map(t => (
                      <option key={t} value={t}>{API_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newCompany.api_slug}
                    onChange={e => setNewCompany(p => ({ ...p, api_slug: e.target.value }))}
                    placeholder="API slug / subdomain"
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                  />
                </div>
                <p className="text-xs text-[var(--color-text-muted)] font-mono">
                  Greenhouse slug: from boards.greenhouse.io/<strong>slug</strong> · Ashby: jobs.ashbyhq.com/<strong>slug</strong> · Lever: jobs.lever.co/<strong>slug</strong>
                </p>
                {addError && <p className="text-xs text-[var(--color-red-indicator)]">{addError}</p>}
                <div className="flex gap-2">
                  <Button variant="primary" onClick={handleAddCompany} className="text-xs font-mono">Add</Button>
                  <Button variant="outline" onClick={() => { setShowAddForm(false); setAddError(''); }} className="text-xs font-mono">Cancel</Button>
                </div>
              </div>
            )}

            {companiesLoading ? (
              <div className="py-8 text-center text-[var(--color-text-muted)] font-mono text-sm animate-pulse">Loading companies…</div>
            ) : (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
                {filteredCompanies.length === 0 && (
                  <div className="py-8 text-center text-[var(--color-text-muted)] text-sm">No companies match your filter.</div>
                )}
                {filteredCompanies.map(company => (
                  <div key={company.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg)]/40 transition-colors">
                    <button
                      onClick={() => handleToggle(company)}
                      aria-label={company.enabled ? 'Disable' : 'Enable'}
                      className={`w-10 h-5 rounded-full transition-colors flex items-center ${
                        company.enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                      }`}
                    >
                      <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ml-0.5 ${company.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                    <Globe className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium text-sm ${company.enabled ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
                        {company.name}
                      </span>
                      <span className="text-xs font-mono text-[var(--color-text-muted)] ml-2">
                        {API_TYPE_LABELS[company.api_type]} · {company.api_slug}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteCompany(company.id)}
                      className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-red-indicator)] hover:bg-[var(--color-red-indicator)]/5 transition-colors"
                      title="Remove company"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Keywords tab ── */}
        {tab === 'keywords' && (
          <div className="space-y-6">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-6">
              <div>
                <h3 className="text-sm font-bold font-mono uppercase text-[var(--color-green-indicator)] mb-3">
                  Must Match (any)
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                  A job title must contain at least one of these keywords to be included.
                </p>
                <TagInput
                  tags={posKws}
                  onChange={setPosKws}
                  placeholder="Add keyword and press Enter…"
                  colorClass="text-[var(--color-green-indicator)] border-[var(--color-green-indicator)]/30 bg-[var(--color-green-indicator)]/5"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold font-mono uppercase text-[var(--color-accent)] mb-3">
                  Exclude If Contains
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                  Jobs with any of these keywords in the title will be filtered out.
                </p>
                <TagInput
                  tags={negKws}
                  onChange={setNegKws}
                  placeholder="Add exclude keyword and press Enter…"
                  colorClass="text-[var(--color-accent)] border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  onClick={handleSaveKeywords}
                  disabled={kwSaving}
                  className="font-mono gap-2"
                >
                  {kwSaved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : 'Save Keywords'}
                </Button>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Changes take effect on the next scan.
                </p>
              </div>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="text-xs font-bold font-mono uppercase text-[var(--color-text-muted)] mb-2">How keywords work</h3>
              <ul className="space-y-1 text-xs text-[var(--color-text-muted)]">
                <li>· Matching is case-insensitive against the job title only</li>
                <li>· A title must match at least 1 positive keyword (unless list is empty = accept all)</li>
                <li>· If a title matches any negative keyword, it is excluded regardless of positive matches</li>
                <li>· "AI Engineer" as a keyword will match "Senior AI Engineer" but not "AI Sales"</li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
