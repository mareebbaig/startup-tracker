import type { Currency } from "@st/shared";

export interface Money {
  amount: number;
  currency: Currency;
  raw: string;
}

const NUM_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einer: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwanzig: 20,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, twelve: 12, twenty: 20,
};

const CUR = String.raw`(€|eur(?:o|os)?\b|\$|us-?dollar|usd\b|dollars?\b|£|gbp\b|chf\b|franken\b)`;
const NUM = String.raw`(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`(mio\b\.?|millionen\b|millions?\b|mn\b|m\b|mrd\b\.?|milliarden?\b|billions?\b|bn\b|b\b|k\b|tsd\b\.?|tausend\b)`;
const WORD = String.raw`(${Object.keys(NUM_WORDS).join("|")})`;

// € 5M | $15 million | €2.1 Mio.
const RE_PREFIX = new RegExp(String.raw`(€|\$|£)\s?${NUM}\s?${UNIT}?`, "i");
// 3 Mio. Euro | 13,3 Mio.-Euro | 12 million euros | 1,8 Mio. EUR | rund 13. Mio. Euro
const RE_SUFFIX = new RegExp(String.raw`${NUM}\.?\s?${UNIT}\s?[-\s]?\s?${CUR}`, "i");
// drei Millionen Euro | einer Million Euro
const RE_WORD = new RegExp(String.raw`\b${WORD}\s+${UNIT}\s?${CUR}`, "i");
// 500.000 Euro | 750,000 euros
const RE_PLAIN = new RegExp(String.raw`${NUM}\s?${CUR}`, "i");

function unitMultiplier(unit?: string): number {
  if (!unit) return 1;
  const u = unit.toLowerCase().replace(/\.$/, "");
  if (/^(mrd|milliarde|milliarden|billion|billions|bn|b)$/.test(u)) return 1e9;
  if (/^(k|tsd|tausend)$/.test(u)) return 1e3;
  return 1e6;
}

function parseCurrency(c: string): Currency {
  const s = c.toLowerCase();
  if (s === "$" || s.includes("dollar") || s === "usd") return "USD";
  if (s === "£" || s === "gbp") return "GBP";
  if (s === "chf" || s === "franken") return "CHF";
  return "EUR";
}

function parseNumber(n: string, hasUnit: boolean): number {
  if (hasUnit) return parseFloat(n.replace(",", "."));
  // no unit: "500.000" / "750,000" = thousands separators
  if (/^\d{1,3}([.,]\d{3})+$/.test(n)) return parseInt(n.replace(/[.,]/g, ""), 10);
  return parseFloat(n.replace(",", "."));
}

/** Finds the first money amount in a text. */
export function findAmount(text: string): Money | null {
  let m = RE_SUFFIX.exec(text);
  if (m) {
    return { amount: parseNumber(m[1], true) * unitMultiplier(m[2]), currency: parseCurrency(m[3]), raw: m[0] };
  }
  m = RE_PREFIX.exec(text);
  if (m) {
    const hasUnit = Boolean(m[3]);
    return { amount: parseNumber(m[2], hasUnit) * unitMultiplier(m[3]), currency: parseCurrency(m[1]), raw: m[0] };
  }
  m = RE_WORD.exec(text);
  if (m) {
    const n = NUM_WORDS[m[1].toLowerCase()] ?? 1;
    return { amount: n * unitMultiplier(m[2]), currency: parseCurrency(m[3]), raw: m[0] };
  }
  m = RE_PLAIN.exec(text);
  if (m) {
    const amount = parseNumber(m[1], false);
    if (amount >= 10_000) return { amount, currency: parseCurrency(m[2]), raw: m[0] };
  }
  return null;
}

/** Title first (most reliable), then body text. */
export function extractAmount(title: string, text: string): Money | null {
  return findAmount(title) ?? findAmount(text);
}
