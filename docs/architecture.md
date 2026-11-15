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

**Decision:** dedupe key = `normalize(companyName) + round + yearMonth`
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

Per company, after extraction:
- **Website** → from article links / simple search
- **Careers page** → check `/careers`, `/jobs`, `/karriere` + known ATS links (Personio, JOIN, Greenhouse, Lever, Ashby)
- **Open roles** → titles from the ATS page (e.g. "Full-stack Engineer")
- **Tech stack** → keywords in job posts (Node, React, TypeScript, Python, …)
- **Team size** → if found
- **Founder / CTO name** → only from public sources (article, imprint)

**Status:** Accepted for phase 2.

---

## ADR-09 — Outreach tracking

**Decision:** status per company:
`new → shortlisted → contacted → replied → applied / deal → archived`
+ notes field + `contactedAt` date.
**Why:** the main use = act on the list, not just read it.
**Status:** Accepted.

---

## ADR-10 — UI

**Decision:** React (Vite) web app + small Express API.
- Table: company, city, amount, round, date, hiring?, stack match, status
- Filters: city, round, amount, "matches my stack", date range
- Optional later: weekly email digest
**Status:** Accepted for phase 2. Phase 1 = CLI / CSV output only.

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
| **1** | RSS fetch + regex extract + dedupe + MongoDB + CSV export | List of funded startups |
| **2** | Enrichment (careers, roles, stack) + React UI + outreach status | Usable daily tool |
| **3** | Ollama fallback, weekly digest, Handelsregister source | Better coverage |

---

## Open questions

1. GitHub repo — private, name `startup-tracker`?
2. MongoDB Atlas account — exists already, or create one?
3. Cities to focus? (all Germany vs. Frankfurt / Berlin / Munich / remote-friendly)
4. Minimum round size worth tracking? (e.g. ≥ €500k)
