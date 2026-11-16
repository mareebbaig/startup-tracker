import { FEEDS } from "./config/feeds.ts";
import { extractRegex } from "./extract/regexExtractor.ts";
import { classify } from "./pipeline.ts";
import { fetchFeed } from "./sources/rss.ts";

/**
 * Checks every feed and shows what the extractor finds. No database needed.
 * Usage: npm run check-feeds
 */
async function main() {
  for (const feed of FEEDS) {
    try {
      const items = await fetchFeed(feed);
      console.log(`\n✓ ${feed.id} (${feed.enabled ? "enabled" : "disabled"}) — ${items.length} items`);
      for (const a of items.slice(0, 15)) {
        const x = extractRegex(a);
        const status = classify(a, x);
        if (status === "not_funding") continue;
        console.log(
          `  [${status}] ${a.title}\n     → ${x.company ?? "?"} | ${x.round} | ${x.amountEur ?? "?"} EUR | ${x.location.city ?? x.location.country} | tech=${x.isTech} | conf=${x.confidence}`,
        );
      }
    } catch (err) {
      console.log(`\n✗ ${feed.id} — ${(err as Error).message}`);
    }
  }
}

main();
