# Career-Ops

AI-powered job fit evaluator. Paste a job description and your CV — get an instant deep evaluation: skill match scores, gap analysis, salary benchmarks, interview prep, and CV tailoring advice. Built with Claude.

## What it does

- **Evaluate fit** — Score any job against your CV across 6 dimensions: CV match, north star alignment, compensation, cultural fit, red flags, and overall
- **Gap analysis** — See exactly which requirements you meet and which you don't, with severity and mitigation advice for each gap
- **Interview prep** — Auto-generated STAR stories for each key requirement, plus red flag Q&A
- **CV tailoring** — Specific edits for your CV and LinkedIn profile to maximize your chances for that role
- **Pipeline tracker** — Track applications through their full lifecycle (Evaluated → Applied → Interview → Offer)
- **Full reports** — Detailed markdown reports saved per application, exportable as PDF

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express v5 (ESM) |
| Database | PostgreSQL |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Auth | JWT in httpOnly cookies (30-day expiry) |
| PDF | Playwright + custom ATS HTML template |

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Anthropic API key

### Install & run

```bash
# Install root dependencies
npm install

# Install and build the frontend
cd client && npm install && npm run build && cd ..

# Start the server — serves API + frontend on port 3001
npm start
```

Open [http://localhost:3001](http://localhost:3001) and create an account.

### Development (with hot reload)

```bash
# Terminal 1 — API server (port 3001)
npm run server:dev

# Terminal 2 — Vite dev server (port 5000, proxies /api → 3001)
cd client && npm run dev
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing auth tokens |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `ANTHROPIC_MODEL` | No | Model override (default: `claude-sonnet-4-6`) |
| `API_PORT` | No | Server port (default: `3001`) |

## API

All routes under `/api/`. Protected routes require a valid session cookie set at login.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Health check + DB status |
| POST | `/api/auth/signup` | — | Create account |
| POST | `/api/auth/login` | — | Sign in |
| POST | `/api/auth/logout` | — | Sign out |
| GET | `/api/auth/me` | ✓ | Current user |
| POST | `/api/evaluate` | ✓ | Evaluate job against CV |
| GET | `/api/applications` | ✓ | List tracked applications |
| POST | `/api/applications` | ✓ | Save application |
| PATCH | `/api/applications/:id` | ✓ | Update status / fields |
| DELETE | `/api/applications/:id` | ✓ | Delete application |
| GET | `/api/applications/:id/report` | ✓ | Full markdown report |
| GET | `/api/cv` | ✓ | Get saved CV |
| PUT | `/api/cv` | ✓ | Save CV |
| POST | `/api/generate-pdf` | ✓ | Generate ATS-optimized PDF |

## Evaluation output

Each evaluation returns structured JSON across 6 blocks:

| Block | Contents |
|-------|----------|
| **A — Role summary** | Archetype, domain, seniority, remote policy, TL;DR |
| **B — CV match** | Requirements met / gaps with severity and mitigation |
| **C — Level strategy** | Detected vs candidate level, positioning advice |
| **D — Compensation** | Salary range, market position, demand trend |
| **E — Personalization** | Specific CV and LinkedIn edits for this role |
| **F — Interview plan** | STAR stories per requirement, red flag Q&A, case study |

Plus: `score` (6 dimensions, 0–5 scale), `recommendation` (APPLY / CONSIDER / SKIP), `keywords`, `company`, `role`.

## Application statuses

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` → `Rejected` / `Discarded`

## Project structure

```
career-ops/
├── server/
│   ├── index.js              # Express app entry — middleware, routes, static serving
│   ├── db.js                 # PostgreSQL pool + schema bootstrap
│   ├── lib/
│   │   ├── evaluation.js     # Claude evaluation logic + prompt assembly
│   │   └── authMiddleware.js # JWT sign/verify + requireAuth middleware
│   └── routes/               # health, auth, evaluate, applications, cv, pdf
├── client/
│   ├── src/
│   │   ├── api.ts            # Typed fetch client for all endpoints
│   │   ├── App.tsx           # Router with public + protected routes
│   │   ├── context/          # Auth context (login/signup/logout state)
│   │   ├── pages/            # LandingPage, EvaluatePage, ResultsPage, PipelinePage, ...
│   │   └── components/       # Layout, ProtectedRoute, UI primitives
│   └── vite.config.ts        # Port 5000, /api proxy → 3001
├── modes/                    # Evaluation prompt files (scoring system + archetypes)
├── templates/                # ATS CV HTML template (Space Grotesk + DM Sans)
└── fonts/                    # Webfonts for PDF generation
```

## License

MIT
