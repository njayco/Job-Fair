# Career-Ops

An AI-powered job search pipeline — originally a Claude Code CLI tool, rebuilt as a full-stack web application with both job-seeker and employer sides.

## Architecture

- **Languages**: Node.js (backend API + scripts), Go (terminal dashboard)
- **Package Manager**: npm (Node.js), Go Modules (dashboard)
- **AI**: Anthropic Claude via Replit AI Integrations (`claude-sonnet-4-6`)
- **Database**: PostgreSQL (Replit built-in, env vars: DATABASE_URL, PGHOST, etc.)
- **Auth**: httpOnly JWT cookies (30-day expiry)
- **Payments**: Stripe (Free tier 3 evals/month, $19/month Pro)

## Workflows

| Workflow | Command | Port | Description |
|----------|---------|------|-------------|
| Start application | `bash run-dashboard.sh` | — | Go TUI dashboard (console) |
| Start API | `npm run server` | 3001 | Express REST API + built React app (full app) |
| Start client | `cd client && npm run dev` | 5000 | Vite+React frontend with HMR (dev only) |

**Primary access point**: Port 3001 serves the full app (API + built React frontend). Use this for production-like testing.  
**Dev with HMR**: Port 5000 (Vite) hot-reloads React changes; API calls proxy to port 3001.  
After changing React code, run `cd client && npm run build` to update the Express-served build.

## Project Structure

```
career-ops/
├── server/                  # Express API backend
│   ├── index.js             # Main app entry, port 3001
│   ├── db.js                # PostgreSQL pool + schema bootstrap
│   ├── package.json         # {"type":"module"} for ESM
│   ├── lib/
│   │   ├── evaluation.js    # Anthropic API evaluation logic
│   │   └── authMiddleware.js # JWT sign/verify, setAuthCookie, requireAuth
│   └── routes/
│       ├── health.js        # GET /api/health
│       ├── auth.js          # POST /api/auth/signup|login|logout; GET /api/auth/me
│       ├── evaluate.js      # POST /api/evaluate (requireAuth)
│       ├── pdf.js           # POST /api/generate-pdf (requireAuth)
│       ├── applications.js  # CRUD /api/applications (requireAuth, scoped to user)
│       ├── cv.js            # GET/PUT /api/cv (requireAuth, scoped to user)
│       ├── billing.js       # Checkout/portal/status (requireAuth)
│       ├── billing-public.js # GET /api/billing/prices|publishable-key (no auth)
│       ├── career-match.js  # POST /api/career-match — Claude career analysis
│       ├── job-finder.js    # POST /api/job-finder — Exa web search for jobs
│       ├── saved-jobs.js    # CRUD /api/saved-jobs — job bookmarks
│       ├── revise-cv.js     # POST /api/revise-cv — Claude CV tailoring
│       └── employer.js      # All /api/employer/* routes (see Employer API below)
├── client/                  # React+Vite frontend
│   ├── src/
│   │   ├── api.ts           # Typed API client for all endpoints
│   │   ├── App.tsx          # Router — public + ProtectedRoute-wrapped routes
│   │   ├── index.css        # Tailwind v4 + CSS vars (dark theme)
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # User state, login/signup/logout
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx       # / — hero + feature cards
│   │   │   ├── LoginPage.tsx         # /login
│   │   │   ├── SignupPage.tsx        # /signup
│   │   │   ├── AccountPage.tsx       # /account — profile + logout
│   │   │   ├── EvaluatePage.tsx      # /evaluate — CV + job input form
│   │   │   ├── ResultsPage.tsx       # /results/:id — evaluation report
│   │   │   ├── PipelinePage.tsx      # /pipeline — application tracker (job-seeker)
│   │   │   ├── ReportPage.tsx        # /report/:id — full markdown report
│   │   │   ├── PricingPage.tsx       # /pricing — Free/$19 Pro tiers
│   │   │   ├── BillingPage.tsx       # /billing — Stripe portal
│   │   │   ├── CareerMatchPage.tsx   # /career-match — AI career analysis
│   │   │   ├── JobFinderPage.tsx     # /job-finder — live job search via Exa
│   │   │   ├── DonatePage.tsx        # /donate
│   │   │   ├── EmployerDashboardPage.tsx  # /employer — job listings + stats
│   │   │   ├── EmployerSearchPage.tsx     # /employer/jobs/:id — upload resumes + ranked results + filters
│   │   │   ├── EmployerCandidateProfilePage.tsx # /employer/jobs/:id/candidates/:cid — full profile
│   │   │   └── EmployerPipelinePage.tsx   # /employer/pipeline — cross-job kanban pipeline
│   │   └── components/
│   │       ├── Layout.tsx              # Header/nav (adapts for employer vs job-seeker)
│   │       ├── ProtectedRoute.tsx      # Redirects unauthenticated users to /login
│   │       ├── ui/                     # Button, Badge primitives
│   │       └── employer/
│   │           └── CandidateTable.tsx  # Sortable ranked candidate table
│   ├── vite.config.ts       # Port 5000, proxy /api → :3001
│   └── package.json
├── dashboard/               # Go TUI (Bubble Tea)
├── modes/                   # Evaluation prompts (from original CLI)
├── templates/               # CV HTML template + portal configs
├── fonts/                   # Space Grotesk + DM Sans woff2 files
├── data/                    # applications.md tracker (legacy)
├── reports/                 # Evaluation reports markdown (legacy)
├── output/                  # Generated PDFs
└── *.mjs                    # Original Node.js pipeline scripts
```

## Job-Seeker API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check + DB status |
| POST | /api/evaluate | AI job evaluation (A-F scoring JSON) |
| POST | /api/generate-pdf | Generate ATS-optimized PDF |
| GET/POST | /api/applications | List / create applications |
| GET/PATCH/DELETE | /api/applications/:id | Get / update / delete application |
| GET | /api/applications/:id/report | Full markdown report |
| GET/PUT | /api/cv | Get / save CV markdown |
| POST | /api/career-match | Claude career archetype analysis |
| POST | /api/job-finder | Live job search (Exa web search) |
| GET/POST/DELETE | /api/saved-jobs | Bookmark / list / remove jobs |
| POST | /api/revise-cv | Claude CV tailoring for a specific role |
| POST | /api/billing/create-checkout-session | Stripe Checkout |
| GET | /api/billing/status | Subscription status |
| POST | /api/billing/create-portal-session | Stripe Customer Portal |
| GET | /api/billing/prices | Public pricing |
| GET | /api/billing/publishable-key | Stripe public key |

## Employer API Endpoints

All routes under `/api/employer/*` require `account_type = 'employer'` in the JWT.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/employer/jobs | List employer's job postings |
| POST | /api/employer/jobs | Create job posting |
| GET | /api/employer/jobs/:id | Get job + candidate summary |
| DELETE | /api/employer/jobs/:id | Delete job posting |
| GET | /api/employer/jobs/:id/candidates | List ranked candidates |
| POST | /api/employer/jobs/:id/candidates/upload | Upload resumes (PDF/DOCX/TXT, up to 20) |
| POST | /api/employer/jobs/:id/evaluate | Batch evaluate all candidates with Claude |
| PATCH | /api/employer/jobs/:id/candidates/:cid | Update candidate status |
| GET | /api/employer/pipeline | All candidates across all jobs (for pipeline view) |
| GET | /api/employer/jobs/:id/candidates/:cid | Full candidate profile + evaluation JSON |
| GET | /api/employer/jobs/:id/candidates/:cid/resume | Download original resume file |
| POST | /api/employer/jobs/:id/candidates/:cid/interview-questions | Generate 10 AI interview questions |

## Authentication

- **Strategy**: httpOnly JWT cookie (`auth_token`), 30-day expiry, sameSite lax
- **Token payload**: `{ id, email, account_type }`
- **Auth routes**: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- **Protected routes**: all `/api/*` except auth + billing-public routes
- **Account types**: `employee` (default) | `employer`
- **DB queries**: scoped to `req.user.id`

## Database Schema

```sql
users (
  id SERIAL PK,
  email VARCHAR UNIQUE,
  password_hash VARCHAR,
  account_type VARCHAR(20) DEFAULT 'employee',
  stripe_customer_id VARCHAR,
  stripe_subscription_id VARCHAR,
  stripe_subscription_status VARCHAR,
  created_at TIMESTAMP
)

cvs (id, user_id → users.id UNIQUE, content_md, updated_at)

applications (
  id, user_id → users.id, company, role, score, status, url,
  report_md, archetype, tldr, remote, comp_score, keywords,
  evaluation_json JSONB, created_at, updated_at
)

career_matches (id, user_id → users.id, query, result_json JSONB, created_at)

job_finder_runs (id, user_id → users.id, query, results_json JSONB, created_at)

saved_jobs (id, user_id → users.id, title, company, url, source, description, saved_at)

employer_jobs (
  id, user_id → users.id, title, description_text, created_at, updated_at
)

employer_candidates (
  id, job_id → employer_jobs.id, filename, parsed_name, parsed_email,
  parsed_phone, parsed_employer, resume_text TEXT,
  resume_file BYTEA, file_mimetype VARCHAR(100),
  match_score INTEGER, status VARCHAR(50) DEFAULT 'Uploaded',
  evaluation_json JSONB, created_at, updated_at
)
```

## Candidate Pipeline Statuses

`Uploaded | Evaluated | Interviewing | Final Round | Offer Sent | Hired | Rejected`

## Candidate Evaluation JSON Schema

Each candidate's `evaluation_json` stores the full AI assessment:

```json
{
  "recommendation": "Strong Hire|Hire|Consider|Weak Match|Do Not Proceed",
  "summary": "Executive overview",
  "role_alignment": "Narrative on fit",
  "skill_match": [{ "requirement": "...", "met": true, "note": "...", "severity": "must_have|nice_to_have" }],
  "strengths": ["..."],
  "gaps": ["..."],
  "seniority": "junior|mid|senior|principal",
  "seniority_rationale": "...",
  "comp_low": 90000,
  "comp_high": 120000,
  "comp_context": "Market context sentence",
  "profile_analysis": "Career progression notes",
  "interview_strategy": { "focus_areas": ["..."], "red_flags": ["..."] },
  "interview_questions": [{ "question": "...", "rationale": "..." }]
}
```

## Application Statuses (Job-Seeker)

`Evaluated | Applied | Responded | Interview | Offer | Rejected | Discarded | SKIP`

## Key Files (Original CLI)

- `generate-pdf.mjs` — Playwright PDF generator (standalone)
- `modes/_shared.md` — Scoring system and archetypes (6 types)
- `modes/oferta.md` — Evaluation blocks A-F definition
- `batch/batch-prompt.md` — Self-contained worker evaluation prompt
- `templates/cv-template.html` — ATS CV template with Space Grotesk + DM Sans

## npm Scripts

- `npm run server` — Start API server (port 3001)
- `npm run server:dev` — Start API server with file watching
- `npm run verify` — Check pipeline integrity
- `npm run normalize` — Normalize application statuses
- `npm run dedup` — Deduplicate tracker entries
- `npm run merge` — Merge tracker data
- `npm run pdf` — Generate PDF CV (standalone)

## Phases

- [x] Phase 1: Backend API (Express + Anthropic + PostgreSQL)
- [x] Phase 2: Web UI (React + Vite, port 5000)
- [x] Phase 3: User Authentication (JWT, email/password)
- [x] Phase 4: Stripe Payments (Free tier 3 evals/month, $19/month Pro)
- [x] Phase 5: Career Match + Job Finder + CV Revision tools
- [x] Phase 6: Employer Mode — job postings, resume batch upload, AI candidate ranking
- [x] Phase 7: Employer Mode — candidate profiles (A-F sections), interview question generation
- [x] Phase 8: Employer Mode — pipeline view, client-side filters, resume download
