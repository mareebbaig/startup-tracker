export type Round =
  | "pre-seed"
  | "seed"
  | "series-a"
  | "series-b"
  | "series-c+"
  | "growth"
  | "unknown";

export type Currency = "EUR" | "USD" | "GBP" | "CHF";

export type OutreachStatus =
  | "new"
  | "shortlisted"
  | "contacted"
  | "replied"
  | "applied"
  | "deal"
  | "archived";

export interface FundingRound {
  round: Round;
  /** Amount in original currency, e.g. 3_000_000 */
  amount?: number;
  currency?: Currency;
  /** Converted to EUR (approx. for non-EUR) */
  amountEur?: number;
  announcedAt: Date;
  investors: string[];
  /** Article URLs */
  sources: string[];
  extractor: "regex" | "llm" | "manual";
  confidence: number;
}

export interface Startup {
  _id?: unknown;
  name: string;
  normalizedName: string;
  website?: string;
  city?: string;
  sectors: string[];
  isTech: boolean;
  rounds: FundingRound[];
  careers?: { url: string; roles: string[]; stack: string[]; checkedAt: Date };
  contacts?: { name: string; role: string; source: string }[];
  outreach: { status: OutreachStatus; notes?: string; contactedAt?: Date };
  createdAt: Date;
  updatedAt: Date;
}

/** One item from a news feed */
export interface Article {
  sourceId: string;
  url: string;
  title: string;
  /** Short plain-text snippet from the feed (not stored in DB) */
  text: string;
  publishedAt: Date;
  /** Country of the source, "DE" = German news site */
  sourceCountry: "DE" | "INTL";
}

export type ArticleStatus =
  | "saved"
  | "not_funding"
  | "not_germany"
  | "too_small"
  | "needs_review";
