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
  careers?: Careers;
  /** How well this startup fits Areeb's profile (see shared/match.ts) */
  match?: Match;
  contacts?: Contact[];
  enrichedAt?: Date;
  enrichError?: string;
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

export type Ats = "personio" | "greenhouse" | "lever" | "ashby" | "recruitee" | "join" | "workable" | "html";

export interface JobRole {
  title: string;
  url?: string;
  location?: string;
  /** software / ML / data role */
  isDev: boolean;
}

export interface Careers {
  /** careers page or job board URL */
  url?: string;
  ats?: Ats;
  slug?: string;
  /** false = job board found by guessing the slug (could be a different company) */
  verified: boolean;
  roles: JobRole[];
  /** tech keywords found in job posts / careers page */
  stack: string[];
  checkedAt: Date;
}

export interface Match {
  /** 0..100 */
  score: number;
  /** stack keywords that match my profile */
  stack: string[];
  devRoles: number;
  hiring: boolean;
}

export interface Contact {
  name: string;
  role: string;
  /** URL where we found it */
  source: string;
}
