import { findAmount } from "./amount.ts";

/** Funding words strong enough on their own in a headline */
const STRONG_TITLE =
  /finanzierungsrunde|finanzierung|kapitalrunde|investment|seed|series[-\s]?[a-h]\b|raises|raised|secures|funding|investors?|investoren/i;

/** Weaker words, only used together with a verb in the title */
const STRONG =
  /finanzierungsrunde|finanzierung|investment|investition|seed|series[-\s]?[a-h]\b|kapital|millionen|mio\.|raises|raised|secures|funding|round|venture|investors?|investoren/i;

const VERBS =
  /\b(sammelt|sichert sich|erhält|holt|schließt|bekommt|wirbt|will mit|raises|raise|secures|receives|closes|lands|bags|leads)\b/i;

/** Roundups / tickers with many companies — not one funding round */
const ROUNDUP =
  /^#(startupticker|dealmonitor|portfolio|startupradar|brandneu)|round-?up|weekly funding|wochenrückblick|newsletter|startup news (for|zum)|startupnews zum/i;

/** M&A, IPO etc. — not a funding round */
const NOT_FUNDING =
  /übernimmt|übernahme|acquires|acquired|acquisition|merger|fusion|börsengang|\bipo\b|insolvenz|insolvency|layoffs|entlässt/i;

export function isFundingNews(title: string, text: string): boolean {
  if (NOT_FUNDING.test(title) || ROUNDUP.test(title)) return false;
  const verbInTitle = VERBS.test(title);
  const moneyInTitle = findAmount(title) !== null;
  if (STRONG_TITLE.test(title)) return true;
  if (moneyInTitle) return true; // "Isar Aerospace: 270 Mio. EUR für …"
  return verbInTitle && STRONG.test(text);
}

/** "#Exklusiv - Xyz sammelt …" → "Xyz sammelt …" (deutsche-startups.de style prefix) */
export function stripTitlePrefix(title: string): string {
  if (ROUNDUP.test(title)) return title;
  return title.replace(/^#\S+\s*[-–:]\s*/, "");
}

/** "angeführt von X und Y", "led by X, Y and Z" → ["X", "Y", "Z"] (rough) */
export function extractInvestors(text: string): string[] {
  const re =
    /(?:angeführt (?:von|vom)|unter (?:der )?führung (?:von|des|der)|lead-investoren?(?: (?:ist|sind|war|waren))?|led by|co-led by|with participation (?:from|of)|beteiligt(?:en)? sich|investoren(?: sind| waren)?:?)\s+([^.;\n]+)/gi;
  const out = new Set<string>();
  for (const m of text.matchAll(re)) {
    for (let part of m[1].split(/,|\bund\b|\band\b|\bsowie\b|\bas well as\b/)) {
      part = part.replace(/^(dem|der|den|des|the|von)\s+/i, "").replace(/\s+(an der runde|in the round).*$/i, "").trim();
      if (part.length >= 2 && part.length <= 60 && /^[\p{Lu}\d]/u.test(part)) out.add(part);
    }
    if (out.size >= 8) break;
  }
  return [...out].slice(0, 8);
}
