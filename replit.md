# Career-Ops

An AI-powered job search pipeline — originally a Claude Code CLI tool, being rebuilt as a full web application.

## Architecture

- **Languages**: Node.js (backend API + scripts), Go (terminal dashboard)
- **Package Manager**: npm (Node.js), Go Modules (dashboard)
- **AI**: Anthropic Claude via Replit AI Integrations (`claude-sonnet-4-6`)
- **Database**: PostgreSQL (Replit built-in, env vars: DATABASE_URL, PGHOST, etc.)

## Workflows

| Workflow | Command | Port | Description |
|----------|---------|------|-------------|
| Start application | `bash run-dashboard.sh` | — | Go TUI dashboard (console) |
| Start API | `npm run server` | 3001 | Express REST API backend |
| Start client | `cd client && npm run dev` | 5000 | Vite+React frontend (webview) |

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
│       └── cv.js            # GET/PUT /api/cv (requireAuth, scoped to user)
├── client/                  # React+Vite frontend
│   ├── src/
│   │   ├── api.ts           # Typed API client for all endpoints
│   │   ├── App.tsx          # Router — public + ProtectedRoute-wrapped routes
│   │   ├── index.css        # Tailwind v4 + CSS vars (dark theme)
│   │   ├── context/
│   │   │   └── AuthContext.tsx    # User state, login/signup/logout
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx    # / — hero + feature cards
│   │   │   ├── LoginPage.tsx      # /login — sign in form
│   │   │   ├── SignupPage.tsx     # /signup — create account form
│   │   │   ├── AccountPage.tsx    # /account — profile + logout
│   │   │   ├── EvaluatePage.tsx   # /evaluate — CV + job input form
│   │   │   ├── ResultsPage.tsx    # /results/:id — evaluation report
│   │   │   ├── PipelinePage.tsx   # /pipeline — application tracker
│   │   │   └── ReportPage.tsx     # /report/:id — full markdown report
│   │   └── components/
│   │       ├── Layout.tsx         # Header/nav with auth state (email + logout)
│   │       ├── ProtectedRoute.tsx # Redirects unauthenticated users to /login
│   │       └── ui/                # Button, Badge primitives
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

## API Endpoints (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check + DB status |
| POST | /api/evaluate | Evaluate job with AI (returns full A-F evaluation JSON) |
| POST | /api/generate-pdf | Generate ATS-optimized PDF from CV data + evaluation |
| GET | /api/applications | List all applications (supports sort, filter, pagination) |
| POST | /api/applications | Create new application |
| GET | /api/applications/:id | Get single application |
| PATCH | /api/applications/:id | Update application (status, fields) |
| DELETE | /api/applications/:id | Delete application |
| GET | /api/applications/:id/report | Get full report markdown |
| GET | /api/cv | Get saved CV markdown |
| PUT | /api/cv | Save CV markdown |

## Authentication

- **Strategy**: httpOnly JWT cookie (`auth_token`), 30-day expiry, sameSite lax
- **Token payload**: `{ id, email }`
- **Auth routes**: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- **Protected routes**: all `/api/*` except auth routes require valid JWT via `requireAuth` middleware
- **DB queries**: scoped to `req.user.id` (each user sees only their own data)

## Database Schema

```sql
users (id SERIAL, email VARCHAR UNIQUE, password_hash VARCHAR, created_at TIMESTAMP)
applications (id, user_id → users.id, company, role, score, status, url, report_md, 
              archetype, tldr, remote, comp_score, keywords, created_at, updated_at)
cvs (id, user_id → users.id UNIQUE, content_md, updated_at)
```

## Application Statuses

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
- [ ] Phase 4: Stripe Payments (subscription tiers)
