# Startup Tracker — Architecture Decisions

**Goal:** Find German tech startups that recently raised funding → use them for **job applications** and **freelance outreach**.

**Constraints:**
- €0 running cost (no paid LLM API, no paid data APIs)
- Personal tool, 1 user
- Stack Areeb already knows: Node.js, React, MongoDB

Each decision below = **context → options → decision → why**.
Status: `Accepted` = go with this, `Open` = still to decide.

---

## ADR-01 — Data source

**Options**
| Option | Cost | Quality | Effort |
|---|---|---|---|
| News RSS feeds (deutsche-startups.de, EU-Startups, Tech.eu, …) | Free | Good, daily | Low |
| Crunchbase / Dealroom API | Expensive | Very good | Low |
| Handelsregister / Bundesanzeiger (Kapitalerhöhung) | Free | Official but slow, messy | High |
| LinkedIn / X scraping | Free | Good | High + ToS risk |

**Decision:** RSS feeds first. Handelsregister maybe later (phase 3).
**Why:** free, easy to parse, funding news appears within 1–2 days.
**Status:** Accepted. Exact feed URLs to be checked in phase 1.

---

## ADR-02 — Extraction (article → structured data)

**Options**
- Regex / rules on headline + first paragraph
- Local LLM via **Ollama** (e.g. Llama 3.1 8B, Qwen 2.5 7B)
- Free API tier (Gemini, Groq) — limits change, not reliable

**Decision:** Pipeline with fallback
1. Regex extractor (fast, free)
2. If confidence low → Ollama (only when running on Areeb's PC)
3. Still unclear → save as `needs_review`

**Why:** regex covers most headlines like
`"Xyz sammelt 5 Mio. Euro ein"`, `"Xyz raises €5M Series A"`.
LLM only for the hard ones → stays fast.

**Design rule:** extractor is an interface → easy to swap later.
```ts
interface Extractor {
  extract(article: Article): Promise<FundingRound | null>; // + confidence 0..1
}
```
**Status:** Accepted.

---

## ADR-03 — Language & runtime

**Decision:** Node.js + **TypeScript**.
**Why:** known stack; types help with the data model (round, amount, currency).
**Status:** Accepted.

---

## ADR-04 — Database

**Options**
- MongoDB Atlas free tier (cloud)
- MongoDB local (Docker)
- SQLite (single file, zero setup)

**Decision:** MongoDB — **Atlas free tier** for the scheduled job, local Docker for dev.
**Why:** known stack, flexible documents (enrichment fields grow over time), Atlas = reachable from GitHub Actions.
**Status:** Accepted.

---

## ADR-05 — Scheduling (when does it run?)

**Options**
| Option | PC must be on? | Cost |
|---|---|---|
| node-cron in a running process | Yes | Free |
| Windows Task Scheduler | Yes | Free |
| **GitHub Actions cron** | No | Free (within limits) |

**Decision:** GitHub Actions scheduled workflow, every 6 hours.
**Why:** runs even when laptop is off; free.
**Trade-off:** Ollama fallback doesn't run there → low-confidence items wait as `needs_review`, processed when the worker runs locally.
**Status:** Accepted.

---

## ADR-06 — Deduplication

**Problem:** same round shows up on 3–4 sites.

**Decision:** one record per company = `normalize(companyName)`.
Inside it, a news item joins an existing round if it's within **60 days** and the round type matches (or one is unknown); otherwise it's a new round.
(Better than `yearMonth`: news on 30 Nov + 2 Dec stays one round.)
- normalize: lowercase, strip `GmbH`, `UG`, `AG`, `SE`, punctuation
- keep all source URLs in one record (`sources: []`)

**Status:** Accepted.

---

## ADR-07 — "Is it tech?" filter

**Decision:** keyword list on title + text (KI, AI, SaaS, Software, Plattform, App, Cloud, Daten, Fintech, DevTools, …) + exclude list (Immobilien, Gastronomie, …).
Store `sector` tags, don't delete non-tech → can re-filter later.
**Status:** Accepted.

---

## ADR-08 — Enrichment (for jobs & clients)

Runs after ingest (`npm run enrich`, also in the 6-hourly workflow, max 25 per run). Re-check every 7 days.

**Order (stop at the first that works):**
1. **Website** → link in the news article whose domain looks like the name (`langdock.com` for "Langdock") → else guess `name.de/.com/.io/.ai/.app/.tech` and check the page title
2. **Job board link** on homepage or careers page → read it via the board's **public API** (clean titles + full job text):
   | Board | Read via |
   |---|---|
   | Personio | `{slug}.jobs.personio.de/xml` |
   | Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs` |
   | Lever | `api.lever.co/v0/postings/{slug}` |
   | Ashby | `api.ashbyhq.com/posting-api/job-board/{slug}` |
   | Recruitee | `{slug}.recruitee.com/api/offers/` |
   | JOIN / Workable / own page | HTML: short link/heading texts that look like job titles |
3. **No board link?** Try the name as slug on the boards above → saved with `verified: false` (UI shows a warning)
4. **Stack** → keywords in job texts (node, react, typescript, python, …)
5. **People** → founder / CEO / CTO names from article text (regex). UI links to a LinkedIn *search*, nothing is scraped from LinkedIn.

**Match score (0–100)** — `packages/shared/src/match.ts`, edit `MY_STACK` there:
- dev roles open: +40 (+10 if 3+)
- each matching stack keyword: +12 (max 36)
- round in last 90 days: +14

**Politeness:** 1 request/sec per host, robots.txt respected for websites, 15 s timeout, 2 MB cap.
**Status:** Accepted.

---

## ADR-09 — Outreach tracking

**Decision:** status per company:
`new → shortlisted → contacted → replied → applied / deal → archived`
+ notes field + `contactedAt` date.
**Why:** the main use = act on the list, not just read it.
**Status:** Accepted.

---

## ADR-10 — UI

**Decision:** React (Vite) + Express API, **runs locally** (`npm run dev`). No hosting needed (personal tool, data in Atlas).
- Table: fit score, company, city, round, amount, date, hiring (dev / all), my-stack tags, status
- Filters: search, city, round, amount, time, status, hiring, dev roles, good match (≥ 50), incl. non-tech; sort by newest / match / amount / name
- Side panel: website (editable), rounds + sources + investors, jobs (dev roles first), stack, people, notes, "re-check" button
- Review tab: unclear headlines → type name → save, or dismiss
**Status:** Accepted (phase 2).

---

## ADR-11 — Repo structure

**Decision:** one repo, npm workspaces:
```
startup-tracker/
  packages/
    shared/   # types, normalize(), constants
    worker/   # fetch RSS → extract → dedupe → enrich → save
    api/      # Express REST API
    web/      # React UI
  docs/
  .github/workflows/ingest.yml
```
**Status:** Accepted.

---

## ADR-12 — Legal & fair use

- Only public company info; respect `robots.txt`; rate-limit requests (1 req/sec per host)
- Store links + short facts, **not** full article text
- Personal data (founder names) = minimal, only what's needed for outreach (GDPR)
- **Cold email in Germany is strict (UWG §7)** → prefer LinkedIn messages or the company's job / contact forms over unsolicited emails
**Status:** Accepted.

---

## ADR-14 — Hosting on Vercel + login

**Decision:**
- UI (static) + API (one Vercel Function) on **Vercel**, built with the **Build Output API** (`scripts/build-vercel.mjs`): esbuild bundles the Express API into one file → no monorepo / TypeScript import issues on Vercel.
- Ingest + enrich stay in **GitHub Actions** (scheduled, no time limits to worry about).
- Function max duration 300 s (Hobby limit) → enough for "re-check" of one startup.
- **Password login** (`APP_PASSWORD`): HttpOnly cookie (HMAC of the password), 30 days. Without `APP_PASSWORD` the API refuses all data on Vercel — so the list can never be public by mistake.
- Mongo connection is only opened **after** the login check, reused while the function is warm.
- Atlas Network Access stays `0.0.0.0/0` (Vercel + GitHub runners have changing IPs) → strong DB password matters.

**Status:** Accepted.

---

## Data model (first version)

```ts
type Round = "pre-seed" | "seed" | "series-a" | "series-b" | "series-c+" | "unknown";

interface Startup {
  _id: string;
  name: string;
  normalizedName: string;
  website?: string;
  city?: string;
  sectors: string[];          // ["ai", "saas"]
  rounds: FundingRound[];
  careers?: { url: string; roles: string[]; stack: string[]; checkedAt: Date };
  contacts?: { name: string; role: string; source: string }[];
  outreach: { status: OutreachStatus; notes?: string; contactedAt?: Date };
  createdAt: Date;
  updatedAt: Date;
}

interface FundingRound {
  round: Round;
  amountEur?: number;         // 5_000_000
  announcedAt: Date;
  investors: string[];
  sources: string[];          // article URLs
  extractor: "regex" | "llm" | "manual";
  confidence: number;         // 0..1
}
```

---

## Roadmap

| Phase | Scope | Output |
|---|---|---|
| **1** ✅ | RSS fetch + regex extract + dedupe + MongoDB + CSV export | List of funded startups |
| **2** ✅ | Enrichment (careers, roles, stack) + React UI + outreach status | Usable daily tool |
| **3** | Ollama fallback, weekly digest, Handelsregister source | Better coverage |

---

## ADR-13 — Scope filters

- **Cities:** all of Germany. City = stored as a detail only, no filtering by city.
- **Minimum round:** ≥ **€500k** (`amountEur >= 500_000`).
  Rounds with unknown amount → keep, mark `amountEur: undefined` (often still relevant).
**Status:** Accepted.

---

## Resolved questions

1. GitHub repo → `startup-tracker` created ✅
2. MongoDB Atlas → existing account, DB `startup_tracker` ✅
3. Cities → all Germany, city only as detail ✅
4. Minimum round → €500k ✅
