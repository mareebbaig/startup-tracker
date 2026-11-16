# Startup Tracker

Personal tool: finds **German tech startups that recently raised funding (≥ €500k)**, for job applications and freelance outreach.

- €0 running cost: RSS feeds + regex extraction (no paid APIs)
- Node.js + TypeScript, MongoDB Atlas, GitHub Actions (every 6 h)

Architecture decisions and roadmap: [docs/architecture.md](docs/architecture.md)

## Setup

```bash
npm install
cp .env.example .env      # paste your MongoDB Atlas connection string
```

## Commands

| Command | What it does |
|---|---|
| `npm run check-feeds` | Tests every feed + shows what the extractor finds. No DB needed. |
| `npm run ingest` | Fetch feeds → extract → save new startups to MongoDB |
| `npm run export` | Tech startups → `data/startups.csv` (add `-- --all` for non-tech too) |
| `npm test` | Extractor + dedupe tests |

## How one run works

```
RSS feeds → new article? → funding news? → in Germany? → ≥ €500k? → sure enough?
                                                                     ├─ yes → startups (merged if already known)
                                                                     └─ no  → review
```

MongoDB collections:
- `startups` — one record per company, with all its rounds
- `articles` — every processed link (so nothing is processed twice)
- `review` — headlines the regex couldn't read well (check by hand, or LLM in phase 3)

## Add a news feed

Edit `packages/worker/src/config/feeds.ts`, then run `npm run check-feeds`.

## Status

- [x] Phase 1 — RSS fetch, regex extraction, dedupe, MongoDB, CSV export, scheduled run
- [ ] Phase 2 — enrichment (careers page, roles, stack) + React UI + outreach status
- [ ] Phase 3 — Ollama fallback, weekly digest, more sources
