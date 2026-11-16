# Startup Tracker

Personal tool: finds **German tech startups that recently raised funding (≥ €500k)**, checks if they're **hiring devs with my stack**, and tracks outreach — for job applications and freelance clients.

- €0 running cost: RSS feeds + regex + public job-board APIs (no paid APIs)
- Node.js + TypeScript, MongoDB Atlas, React, GitHub Actions (every 6 h)

Architecture decisions and roadmap: [docs/architecture.md](docs/architecture.md)

## Setup

```bash
npm install
cp .env.example .env      # paste your MongoDB Atlas connection string
```

## Daily use

```bash
npm run dev               # API on :4000 + UI on http://localhost:5173
```

## Deploy on Vercel

The UI + API run on Vercel; ingest/enrich keep running in GitHub Actions.

1. vercel.com → **Add New → Project** → import `startup-tracker` from GitHub
2. Leave framework / build settings as they are (`vercel.json` sets them)
3. **Environment Variables** (Production):
   - `MONGODB_URI` — same Atlas string as in `.env`
   - `MONGODB_DB` — `startup_tracker`
   - `APP_PASSWORD` — a long password for the login screen
4. **Deploy** → open the URL → log in

Every push to `main` deploys again. Test the Vercel build locally: `npm run build:vercel`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API + UI with live reload |
| `npm run build` then `npm start` | Built UI served by the API on http://localhost:4000 |
| `npm run check-feeds` | Tests every feed + shows what the extractor finds. No DB needed. |
| `npm run ingest` | Fetch feeds → extract → save new startups |
| `npm run enrich` | Website, job board, roles, stack, founders for up to 20 due startups (`-- --limit 50`, `-- --name Langdock`) |
| `npm run export` | Tech startups → `data/startups.csv` (`-- --all` for non-tech too) |
| `npm run build:vercel` | Build for Vercel → `.vercel/output` |
| `npm test` | All tests |

## How it works

```
ingest:  RSS → funding news? → Germany? → ≥ €500k? → sure? ─ yes → startups
                                                          └ no  → review (fix in UI)
enrich:  article → website → job board (Personio / Greenhouse / Lever / Ashby / Recruitee / careers page)
         → roles + stack → match score 0–100
```

Change what counts as a match: `MY_STACK` in `packages/shared/src/match.ts`.

## Packages

| Package | |
|---|---|
| `packages/shared` | types, name normalizing, match score |
| `packages/worker` | ingest, extract, enrich, export |
| `packages/api` | Express REST API (`/api/startups`, `/api/review`, `/api/meta`) |
| `packages/web` | React UI |

## Status

- [x] Phase 1 — RSS fetch, regex extraction, dedupe, MongoDB, CSV export, scheduled run
- [x] Phase 2 — enrichment (website, job boards, roles, stack, founders) + React UI + outreach status
- [ ] Phase 3 — Ollama fallback, weekly digest, DealMonitor parsing, more sources
