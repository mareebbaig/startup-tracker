export interface FeedConfig {
  id: string;
  url: string;
  /** "DE" = German news site (Germany assumed unless a foreign place is found) */
  country: "DE" | "INTL";
  enabled: boolean;
}

/**
 * News feeds. Run `npm run check-feeds` to see which ones work.
 * Add / disable feeds here — nothing else needs to change.
 */
export const FEEDS: FeedConfig[] = [
  { id: "deutsche-startups", url: "https://www.deutsche-startups.de/feed/", country: "DE", enabled: true },
  { id: "startbase", url: "https://www.startbase.com/feed/", country: "DE", enabled: true },
  { id: "munich-startup", url: "https://www.munich-startup.de/feed/", country: "DE", enabled: true },
  { id: "eu-startups", url: "https://www.eu-startups.com/feed/", country: "INTL", enabled: true },
  { id: "tech-eu", url: "https://tech.eu/feed/", country: "INTL", enabled: true },
];

/** Approx. FX rates to EUR — only used for the €500k filter and sorting. Update now and then. */
export const FX_TO_EUR = { EUR: 1, USD: 0.86, GBP: 1.15, CHF: 1.05 } as const;

export const USER_AGENT =
  "startup-tracker/0.1 (personal research tool; +https://github.com/mareebbaig/startup-tracker)";
