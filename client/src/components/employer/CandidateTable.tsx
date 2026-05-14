import { useState } from 'react';
import { Link } from 'react-router-dom';
import { updateCandidateStatus } from '../../api';
import type { EmployerCandidate } from '../../api';
import { ChevronUp, ChevronDown, Mail, Phone, Building2, ExternalLink } from 'lucide-react';

const CANDIDATE_STATUSES = ['Uploaded', 'Evaluated', 'Interviewing', 'Offer', 'Hired', 'Rejected'] as const;

const RECOMMENDATION_COLORS: Record<string, string> = {
  'Strong Hire': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Hire': 'bg-green-500/15 text-green-400 border-green-500/30',
  'Consider': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'Weak Match': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'Do Not Proceed': 'bg-red-500/15 text-red-400 border-red-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  'Uploaded': 'bg-zinc-500/20 text-zinc-400',
  'Evaluated': 'bg-blue-500/15 text-blue-400',
  'Interviewing': 'bg-purple-500/15 text-purple-400',
  'Offer': 'bg-yellow-500/15 text-yellow-400',
  'Hired': 'bg-emerald-500/15 text-emerald-400',
  'Rejected': 'bg-red-500/15 text-red-400',
};

function ScoreRing({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[var(--color-text-muted)] font-mono text-sm">—</span>;
  const color =
    score >= 80 ? '#10b981' :
    score >= 65 ? '#f59e0b' :
    '#71717a';
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center w-12 h-12">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-bold font-mono" style={{ color }}>{score}</span>
    </div>
  );
}

type SortKey = 'match_score' | 'parsed_name' | 'recommendation';

interface Props {
  jobId: number;
  candidates: EmployerCandidate[];
  onCandidatesChange: (updated: EmployerCandidate[]) => void;
}

export default function CandidateTable({ jobId, candidates, onCandidatesChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('match_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'match_score' ? 'desc' : 'asc');
    }
  };

  const sorted = [...candidates].sort((a, b) => {
    let av: string | number = 0, bv: string | number = 0;
    if (sortKey === 'match_score') {
      av = a.match_score ?? -1;
      bv = b.match_score ?? -1;
    } else if (sortKey === 'parsed_name') {
      av = (a.parsed_name || a.filename).toLowerCase();
      bv = (b.parsed_name || b.filename).toLowerCase();
    } else if (sortKey === 'recommendation') {
      const order = ['Strong Hire', 'Hire', 'Consider', 'Weak Match', 'Do Not Proceed'];
      av = order.indexOf(a.recommendation || '');
      bv = order.indexOf(b.recommendation || '');
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleStatusChange = async (candidateId: number, status: string) => {
    setUpdatingId(candidateId);
    try {
      const updated = await updateCandidateStatus(jobId, candidateId, status);
      onCandidatesChange(candidates.map(c => c.id === candidateId ? { ...c, ...updated } : c));
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3 opacity-30" />;

  if (!candidates.length) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <th
              className="px-4 py-3 text-left font-mono text-xs text-[var(--color-text-muted)] uppercase cursor-pointer hover:text-[var(--color-text)] transition-colors"
              onClick={() => handleSort('match_score')}
            >
              <div className="flex items-center gap-1">Score <SortIcon col="match_score" /></div>
            </th>
            <th
              className="px-4 py-3 text-left font-mono text-xs text-[var(--color-text-muted)] uppercase cursor-pointer hover:text-[var(--color-text)] transition-colors"
              onClick={() => handleSort('parsed_name')}
            >
              <div className="flex items-center gap-1">Candidate <SortIcon col="parsed_name" /></div>
            </th>
            <th
              className="px-4 py-3 text-left font-mono text-xs text-[var(--color-text-muted)] uppercase cursor-pointer hover:text-[var(--color-text)] transition-colors"
              onClick={() => handleSort('recommendation')}
            >
              <div className="flex items-center gap-1">Recommendation <SortIcon col="recommendation" /></div>
            </th>
            <th className="px-4 py-3 text-left font-mono text-xs text-[var(--color-text-muted)] uppercase">Current Employer</th>
            <th className="px-4 py-3 text-left font-mono text-xs text-[var(--color-text-muted)] uppercase">Contact</th>
            <th className="px-4 py-3 text-left font-mono text-xs text-[var(--color-text-muted)] uppercase">Status</th>
            <th className="px-4 py-3 text-left font-mono text-xs text-[var(--color-text-muted)] uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, idx) => (
            <tr
              key={c.id}
              className={`border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)]/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-[var(--color-surface)]/20'}`}
            >
              <td className="px-4 py-3">
                <ScoreRing score={c.match_score} />
              </td>
              <td className="px-4 py-3 max-w-[200px]">
                <div className="font-medium text-[var(--color-text)] truncate">
                  {c.parsed_name || c.filename.replace(/\.[^.]+$/, '')}
                </div>
                {c.seniority && (
                  <div className="text-xs font-mono text-[var(--color-text-muted)] capitalize mt-0.5">{c.seniority}</div>
                )}
                {c.summary && (
                  <div className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2 max-w-[220px]">{c.summary}</div>
                )}
              </td>
              <td className="px-4 py-3">
                {c.recommendation ? (
                  <span className={`inline-block text-xs font-mono px-2 py-1 rounded-full border ${RECOMMENDATION_COLORS[c.recommendation] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
                    {c.recommendation}
                  </span>
                ) : (
                  <span className="text-[var(--color-text-muted)] text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {c.parsed_employer ? (
                  <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] max-w-[160px]">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs truncate">{c.parsed_employer}</span>
                  </div>
                ) : (
                  <span className="text-[var(--color-text-muted)] text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3 max-w-[180px]">
                <div className="space-y-0.5">
                  {c.parsed_email && (
                    <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{c.parsed_email}</span>
                    </div>
                  )}
                  {c.parsed_phone && (
                    <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Phone className="w-3 h-3 shrink-0" />
                      <span>{c.parsed_phone}</span>
                    </div>
                  )}
                  {!c.parsed_email && !c.parsed_phone && (
                    <span className="text-xs text-[var(--color-text-muted)]">—</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <select
                  value={c.status}
                  disabled={updatingId === c.id}
                  onChange={e => handleStatusChange(c.id, e.target.value)}
                  className={`text-xs font-mono rounded px-2 py-1 border-0 cursor-pointer ${STATUS_COLORS[c.status] || ''} bg-transparent`}
                  style={{ background: 'transparent' }}
                >
                  {CANDIDATE_STATUSES.map(s => (
                    <option key={s} value={s} className="bg-[#1a1a2e] text-white">{s}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <Link
                  to={`/employer/jobs/${jobId}/candidates/${c.id}`}
                  className="inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Profile
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
