// Career-Ops API Client
// All requests proxy through /api → localhost:3001

export type AppStatus =
  | 'Evaluated'
  | 'Applied'
  | 'Responded'
  | 'Interview'
  | 'Offer'
  | 'Rejected'
  | 'Discarded'
  | 'SKIP';

export interface Application {
  id: number;
  user_id: number | null;
  company: string;
  role: string;
  score: string | null;
  status: AppStatus;
  url: string | null;
  report_md: string | null;
  report_preview: string | null;
  archetype: string | null;
  tldr: string | null;
  remote: string | null;
  comp_score: string | null;
  keywords: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationsResponse {
  applications: Application[];
  total: number;
  limit: number;
  offset: number;
}

export interface ScoreBreakdown {
  cv_match: number;
  north_star: number;
  comp: number;
  cultural: number;
  red_flags: number;
  global: number;
}

export interface BlockA {
  archetype: string;
  domain: string;
  function: string;
  seniority: string;
  remote: string;
  team_size: string | null;
  tldr: string;
}

export interface Match {
  requirement: string;
  cv_match: string;
  strength: 'strong' | 'partial' | 'weak';
}

export interface Gap {
  gap: string;
  severity: 'blocker' | 'nice-to-have';
  mitigation: string;
}

export interface BlockB {
  matches: Match[];
  gaps: Gap[];
}

export interface BlockC {
  level_detected: string;
  candidate_level: string;
  senior_pitch: string;
  downlevel_plan: string;
}

export interface BlockD {
  salary_range: string;
  market_position: string;
  company_comp_reputation: string;
  demand_trend: string;
}

export interface CvChange {
  section: string;
  current: string;
  proposed: string;
  reason: string;
}

export interface LinkedInChange {
  section: string;
  change: string;
  reason: string;
}

export interface BlockE {
  cv_changes: CvChange[];
  linkedin_changes: LinkedInChange[];
}

export interface StarStory {
  requirement: string;
  story: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
}

export interface RedFlagQuestion {
  question: string;
  response: string;
}

export interface BlockF {
  star_stories: StarStory[];
  recommended_case_study: string;
  red_flag_questions: RedFlagQuestion[];
}

export interface Evaluation {
  archetype: string;
  archetype_secondary: string | null;
  score: ScoreBreakdown;
  block_a: BlockA;
  block_b: BlockB;
  block_c: BlockC;
  block_d: BlockD;
  block_e: BlockE;
  block_f: BlockF;
  keywords: string[];
  company: string;
  role: string;
  recommendation: 'APPLY' | 'CONSIDER' | 'SKIP';
  recommendation_reason: string;
}

export interface EvaluateResponse {
  application_id: number;
  evaluation: Evaluation;
  report_md: string;
  summary: {
    company: string;
    role: string;
    archetype: string;
    score: number;
    recommendation: string;
    recommendation_reason: string;
    tldr: string;
  };
}

export interface CvData {
  content_md: string | null;
  updated_at: string | null;
}

// Health check
export async function getHealth() {
  const res = await fetch('/api/health');
  return res.json();
}

// CV
export async function getCv(): Promise<CvData> {
  const res = await fetch('/api/cv');
  if (!res.ok) throw new Error('Failed to fetch CV');
  return res.json();
}

export async function saveCv(content_md: string): Promise<CvData> {
  const res = await fetch('/api/cv', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_md }),
  });
  if (!res.ok) throw new Error('Failed to save CV');
  return res.json();
}

// Evaluate
export async function evaluate(params: {
  job_description?: string;
  job_url?: string;
  cv_content: string;
}): Promise<EvaluateResponse> {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.message || data.error || 'Evaluation failed');
    err.code = data.code;
    err.usageCount = data.usageCount;
    err.freeLimit = data.freeLimit;
    throw err;
  }
  return data;
}

// Generate PDF (returns a blob)
export async function generatePdf(params: {
  cv_markdown?: string;
  cv_data?: Record<string, unknown>;
  evaluation?: Evaluation;
  application_id?: number;
}): Promise<Blob> {
  const res = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'PDF generation failed');
  }
  return res.blob();
}

// Applications
export async function getApplications(params?: {
  sort?: string;
  order?: 'asc' | 'desc';
  status?: AppStatus;
  limit?: number;
  offset?: number;
}): Promise<ApplicationsResponse> {
  const query = new URLSearchParams();
  if (params?.sort) query.set('sort', params.sort);
  if (params?.order) query.set('order', params.order);
  if (params?.status) query.set('status', params.status);
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  const res = await fetch(`/api/applications?${query}`);
  if (!res.ok) throw new Error('Failed to fetch applications');
  return res.json();
}

export async function getApplication(id: number): Promise<Application> {
  const res = await fetch(`/api/applications/${id}`);
  if (!res.ok) throw new Error('Application not found');
  return res.json();
}

export async function getApplicationReport(id: number): Promise<{ id: number; company: string; role: string; report_md: string }> {
  const res = await fetch(`/api/applications/${id}/report`);
  if (!res.ok) throw new Error('Report not found');
  return res.json();
}

export async function updateApplicationStatus(id: number, status: AppStatus): Promise<Application> {
  const res = await fetch(`/api/applications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function deleteApplication(id: number): Promise<{ deleted: boolean; id: number }> {
  const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete application');
  return res.json();
}

// Helpers
export const APP_STATUSES: AppStatus[] = [
  'Evaluated', 'Applied', 'Responded', 'Interview',
  'Offer', 'Rejected', 'Discarded', 'SKIP',
];

export function scoreColor(score: number | string | null): 'green' | 'yellow' | 'red' | 'gray' {
  const n = parseFloat(String(score ?? ''));
  if (isNaN(n)) return 'gray';
  if (n >= 4.0) return 'green';
  if (n >= 3.0) return 'yellow';
  return 'red';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
