import "./env.ts";
import { FEEDS } from "./config/feeds.ts";
import { connect, isKnownArticle, markArticle, saveForReview, upsertStartup } from "./db.ts";
import { extractRegex } from "./extract/regexExtractor.ts";
import { classify } from "./pipeline.ts";
import { fetchFeed, sleep } from "./sources/rss.ts";

/**
 * One run: every feed → every new article → extract → classify → save.
 * Usage: npm run ingest
 */
async function main() {
  const { client, db } = await connect();
  const stats: Record<string, number> = {};
  const bump = (k: string) => (stats[k] = (stats[k] ?? 0) + 1);
  let feedsOk = 0;

  try {
    for (const feed of FEEDS.filter((f) => f.enabled)) {
      let articles;
      try {
        articles = await fetchFeed(feed);
        feedsOk++;
        console.log(`✓ ${feed.id}: ${articles.length} items`);
      } catch (err) {
        console.warn(`✗ ${feed.id}: ${(err as Error).message}`);
        continue;
      }

      for (const a of articles) {
        if (await isKnownArticle(db, a.url)) {
          bump("already_seen");
          continue;
        }
        const x = extractRegex(a);
        const status = classify(a, x);
        bump(status);

        if (status === "saved") {
          const r = await upsertStartup(db, a, x);
          bump(`startup_${r}`);
          console.log(`  + ${x.company} | ${x.round} | ${x.amountEur ?? "?"} EUR | ${x.location.city ?? "-"}`);
        } else if (status === "needs_review") {
          await saveForReview(db, a, x);
        }
        await markArticle(db, a, status, x.company);
      }
      await sleep(1000); // be polite between sites
    }
  } finally {
    await client.close();
  }

  console.log("\nSummary:", stats);
  if (feedsOk === 0) {
    console.error("All feeds failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
