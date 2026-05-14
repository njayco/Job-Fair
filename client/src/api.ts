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
  evaluation_json: Evaluation | null;
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
    const evalError = Object.assign(
      new Error(data.message || data.error || 'Evaluation failed'),
      {
        code: data.code as string | undefined,
        usageCount: data.usageCount as number | undefined,
        freeLimit: data.freeLimit as number | undefined,
      }
    );
    throw evalError;
  }
  return data;
}

// Revise CV with AI suggestions
export async function reviseCv(params: {
  cv_content: string;
  cv_changes: CvChange[];
  company?: string;
  role?: string;
}): Promise<{ revised_cv: string }> {
  const res = await fetch('/api/revise-cv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to revise CV');
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

// Career Matching
export interface CareerMatch {
  role: string;
  match_pct: number;
  salary_range: string;
  growth_outlook: string;
  transition_difficulty: string;
  why_you_match: string;
}

export interface CareerIdentity {
  current: string;
  emerging: string;
  long_term: string;
}

export interface CareerLinkedIn {
  headline: string;
  about: string;
}

export interface CareerStrengthsGaps {
  strongest: string[];
  underutilized: string[];
  missing_keywords: string[];
}

export interface CareerMatchResult {
  id: number;
  created_at: string;
  career_matches: CareerMatch[];
  career_identity: CareerIdentity;
  linkedin: CareerLinkedIn;
  strengths_gaps: CareerStrengthsGaps;
}

export interface CareerMatchHistoryItem {
  id: number;
  top_role: string | null;
  top_pct: number | null;
  created_at: string;
}

export async function careerMatch(cvContent?: string): Promise<CareerMatchResult> {
  const res = await fetch('/api/career-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(cvContent ? { cv_content: cvContent } : {}),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = Object.assign(new Error(data.error || 'Career analysis failed'), { code: data.code });
    throw err;
  }
  return data;
}

export async function getCareerMatchHistory(): Promise<{ history: CareerMatchHistoryItem[] }> {
  const res = await fetch('/api/career-match', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch career match history');
  return res.json();
}

export async function getCareerMatch(id: number): Promise<CareerMatchResult> {
  const res = await fetch(`/api/career-match/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Career match not found');
  const row = await res.json();
  return { id: row.id, created_at: row.created_at, ...row.result_json };
}

// Job Finder
export interface JobFinderPreferences {
  location?: string;
  work_style?: 'remote' | 'hybrid' | 'on-site' | '';
  salary_min?: number | '';
  salary_max?: number | '';
  focus_area?: string;
}

export interface JobFinderResult {
  index: number;
  role: string;
  company: string;
  url: string;
  location: string;
  remote_ok: boolean;
  match_pct: number;
  why_match: string[];
  skill_gaps: string[];
  comp_low: number | null;
  comp_high: number | null;
  description: string;
  full_text?: string;
}

export interface JobFinderRun {
  id: number;
  created_at: string;
  preferences: JobFinderPreferences;
  results: JobFinderResult[];
}

export interface JobFinderHistoryItem {
  id: number;
  top_role: string | null;
  top_pct: number | null;
  result_count: number;
  preferences: JobFinderPreferences;
  created_at: string;
}

export async function findJobs(params: {
  preferences: JobFinderPreferences;
  cv_content?: string;
}): Promise<JobFinderRun> {
  const res = await fetch('/api/job-finder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params.cv_content
      ? { preferences: params.preferences, cv_content: params.cv_content }
      : { preferences: params.preferences }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Job search failed'), { code: data.code });
  }
  return data;
}

export async function getJobFinderHistory(): Promise<{ history: JobFinderHistoryItem[] }> {
  const res = await fetch('/api/job-finder/history', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function getJobFinderRun(id: number): Promise<JobFinderRun> {
  const res = await fetch(`/api/job-finder/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Run not found');
  return res.json();
}

// Saved Jobs
export interface SavedJob {
  id: number;
  job_finder_run_id: number | null;
  role: string;
  company: string;
  url: string | null;
  match_pct: number | null;
  notes: string | null;
  created_at: string;
}

export async function getSavedJobs(): Promise<{ saved_jobs: SavedJob[] }> {
  const res = await fetch('/api/saved-jobs', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch saved jobs');
  return res.json();
}

export async function saveJob(params: {
  job_finder_run_id?: number | null;
  role: string;
  company: string;
  url?: string;
  match_pct?: number;
  notes?: string;
}): Promise<SavedJob> {
  const res = await fetch('/api/saved-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save job');
  return data;
}

export async function deleteSavedJob(id: number): Promise<{ deleted: boolean; id: number }> {
  const res = await fetch(`/api/saved-jobs/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete saved job');
  return res.json();
}

// ── Employer API ─────────────────────────────────────────────────────────────

export interface EmployerJob {
  id: number;
  title: string;
  description_text: string;
  candidate_count?: number;
  avg_score?: number;
  created_at: string;
}

export interface EmployerCandidate {
  id: number;
  filename: string;
  parsed_name: string | null;
  parsed_email: string | null;
  parsed_phone: string | null;
  parsed_employer: string | null;
  match_score: number | null;
  status: string;
  recommendation: string | null;
  summary: string | null;
  strengths: string[] | null;
  gaps: string[] | null;
  seniority: string | null;
  comp_low: number | null;
  comp_high: number | null;
  created_at: string;
}

export async function getEmployerJobs(): Promise<{ jobs: EmployerJob[] }> {
  const res = await fetch('/api/employer/jobs', { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch jobs');
  return data;
}

export async function createEmployerJob(body: { title?: string; description_text: string }): Promise<EmployerJob> {
  const res = await fetch('/api/employer/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create job');
  return data;
}

export async function getEmployerJob(id: number): Promise<{ job: EmployerJob; candidates: EmployerCandidate[] }> {
  const res = await fetch(`/api/employer/jobs/${id}`, { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch job');
  return data;
}

export async function deleteEmployerJob(id: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/employer/jobs/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete job');
  return data;
}

export async function uploadCandidates(
  jobId: number,
  files: File[]
): Promise<{ uploaded: number; candidates: EmployerCandidate[]; errors: { filename: string; error: string }[] }> {
  const fd = new FormData();
  files.forEach(f => fd.append('resumes', f));
  const res = await fetch(`/api/employer/jobs/${jobId}/candidates/upload`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export async function evaluateCandidates(
  jobId: number
): Promise<{ evaluated: number; candidates: EmployerCandidate[] }> {
  const res = await fetch(`/api/employer/jobs/${jobId}/evaluate`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Evaluation failed');
  return data;
}

export async function getJobCandidates(
  jobId: number
): Promise<{ candidates: EmployerCandidate[] }> {
  const res = await fetch(`/api/employer/jobs/${jobId}/candidates`, {
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch candidates');
  return data;
}

export async function updateCandidateStatus(
  jobId: number,
  candidateId: number,
  status: string
): Promise<EmployerCandidate> {
  const res = await fetch(`/api/employer/jobs/${jobId}/candidates/${candidateId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update status');
  return data;
}

export type CandidateStatus = 'Uploaded' | 'Evaluated' | 'Interviewing' | 'Offer' | 'Hired' | 'Rejected';
export const CANDIDATE_STATUSES: CandidateStatus[] = ['Evaluated', 'Interviewing', 'Offer', 'Hired', 'Rejected'];

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
