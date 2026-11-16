import { MIN_ROUND_EUR, type Article, type ArticleStatus } from "@st/shared";
import type { Extraction } from "./extract/regexExtractor.ts";

/** Below this, the item goes to the review list instead of the startups list */
export const MIN_CONFIDENCE = 0.6;

/**
 * Decide what to do with one article. Pure function → easy to test.
 * Order: funding? → Germany? → big enough? → sure enough?
 */
export function classify(article: Article, x: Extraction): ArticleStatus {
  if (!x.isFunding) return "not_funding";
  const { country } = x.location;
  if (country === "FOREIGN") return "not_germany";
  if (country === "UNKNOWN" && article.sourceCountry !== "DE") return "not_germany";
  if (x.amountEur !== undefined && x.amountEur < MIN_ROUND_EUR) return "too_small";
  if (!x.company || x.confidence < MIN_CONFIDENCE) return "needs_review";
  return "saved";
}
