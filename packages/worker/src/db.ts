import { MongoClient, type Db } from "mongodb";
import { normalizeName, type Article, type ArticleStatus, type FundingRound, type Startup } from "@st/shared";
import type { Extraction } from "./extract/regexExtractor.ts";

/** Two news items about the same company within this window = same round (ADR-06) */
const SAME_ROUND_DAYS = 60;

export async function connect(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing. Copy .env.example to .env and fill it in.");
  const client = new MongoClient(uri, { ignoreUndefined: true });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "startup_tracker");
  await ensureIndexes(db);
  return { client, db };
}

async function ensureIndexes(db: Db) {
  await db.collection("articles").createIndex({ url: 1 }, { unique: true });
  await db.collection("startups").createIndex({ normalizedName: 1 }, { unique: true });
  await db.collection("startups").createIndex({ "rounds.announcedAt": -1 });
  await db.collection("review").createIndex({ url: 1 }, { unique: true });
}

export async function isKnownArticle(db: Db, url: string): Promise<boolean> {
  return (await db.collection("articles").countDocuments({ url }, { limit: 1 })) > 0;
}

/** We keep only link + title + result — no article text (ADR-12) */
export async function markArticle(db: Db, a: Article, status: ArticleStatus, company?: string | null) {
  await db.collection("articles").updateOne(
    { url: a.url },
    {
      $setOnInsert: { url: a.url, title: a.title, sourceId: a.sourceId, publishedAt: a.publishedAt, createdAt: new Date() },
      $set: { status, company: company ?? null, processedAt: new Date() },
    },
    { upsert: true },
  );
}

export async function saveForReview(db: Db, a: Article, x: Extraction) {
  await db.collection("review").updateOne(
    { url: a.url },
    { $setOnInsert: { url: a.url, title: a.title, publishedAt: a.publishedAt, extraction: x, createdAt: new Date() } },
    { upsert: true },
  );
}

function sameRound(r: FundingRound, x: Extraction, date: Date): boolean {
  const days = Math.abs(r.announcedAt.getTime() - date.getTime()) / 86_400_000;
  const roundsMatch = r.round === x.round || r.round === "unknown" || x.round === "unknown";
  return days <= SAME_ROUND_DAYS && roundsMatch;
}

/** Insert new startup, or merge the news into an existing one (dedupe). */
export async function upsertStartup(db: Db, a: Article, x: Extraction): Promise<"created" | "merged" | "new_round"> {
  const col = db.collection<Startup>("startups");
  const name = x.company!;
  const normalizedName = normalizeName(name);
  const now = new Date();
  const round: FundingRound = {
    round: x.round,
    amount: x.amount,
    currency: x.currency,
    amountEur: x.amountEur,
    announcedAt: a.publishedAt,
    investors: x.investors,
    sources: [a.url],
    extractor: x.extractor,
    confidence: x.confidence,
  };

  const existing = await col.findOne({ normalizedName });
  if (!existing) {
    await col.insertOne({
      name,
      normalizedName,
      city: x.location.city,
      sectors: x.sectors,
      isTech: x.isTech,
      rounds: [round],
      outreach: { status: "new" },
      createdAt: now,
      updatedAt: now,
    });
    return "created";
  }

  const idx = existing.rounds.findIndex((r) => sameRound(r, x, a.publishedAt));
  const rounds = [...existing.rounds];
  let result: "merged" | "new_round";
  if (idx >= 0) {
    const r = rounds[idx];
    rounds[idx] = {
      ...r,
      round: r.round === "unknown" ? x.round : r.round,
      amount: r.amount ?? x.amount,
      currency: r.currency ?? x.currency,
      amountEur: r.amountEur ?? x.amountEur,
      investors: [...new Set([...r.investors, ...x.investors])],
      sources: [...new Set([...r.sources, a.url])],
      confidence: Math.max(r.confidence, x.confidence),
    };
    result = "merged";
  } else {
    rounds.push(round);
    result = "new_round";
  }

  await col.updateOne(
    { _id: existing._id },
    {
      $set: {
        rounds,
        city: existing.city ?? x.location.city,
        sectors: [...new Set([...existing.sectors, ...x.sectors])],
        isTech: existing.isTech || x.isTech,
        updatedAt: now,
      },
    },
  );
  return result;
}
