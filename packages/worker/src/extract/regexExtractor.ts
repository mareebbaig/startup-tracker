import type { Article, Currency, Round } from "@st/shared";
import { FX_TO_EUR } from "../config/feeds.ts";
import { extractAmount } from "./amount.ts";
import { extractCompany } from "./company.ts";
import { extractInvestors, isFundingNews, stripTitlePrefix } from "./funding.ts";
import { extractLocation, type Location } from "./location.ts";
import { extractRound } from "./round.ts";
import { extractSectors } from "./sector.ts";

export interface Extraction {
  isFunding: boolean;
  company: string | null;
  amount?: number;
  currency?: Currency;
  amountEur?: number;
  round: Round;
  location: Location;
  sectors: string[];
  isTech: boolean;
  investors: string[];
  /** 0..1 — how sure we are about company + funding */
  confidence: number;
  extractor: "regex";
}

/** Same interface an LLM extractor would use later (ADR-02) */
export interface Extractor {
  extract(article: Article): Promise<Extraction>;
}

export function extractRegex(article: Article): Extraction {
  const title = stripTitlePrefix(article.title);
  const { text } = article;
  const isFunding = isFundingNews(title, text);
  const company = extractCompany(title);
  const money = extractAmount(title, text);
  const round = extractRound(title, text);
  const location = extractLocation(title, text);
  const { sectors, isTech } = extractSectors(title, text);
  const investors = extractInvestors(text);

  let confidence = 0;
  if (isFunding) confidence += 0.2;
  if (company) confidence += 0.4;
  if (money) confidence += 0.3;
  if (round !== "unknown") confidence += 0.1;

  return {
    isFunding,
    company,
    amount: money?.amount,
    currency: money?.currency,
    amountEur: money ? Math.round(money.amount * FX_TO_EUR[money.currency]) : undefined,
    round,
    location,
    sectors,
    isTech,
    investors,
    confidence: Math.round(confidence * 100) / 100,
    extractor: "regex",
  };
}

export const regexExtractor: Extractor = {
  extract: async (a) => extractRegex(a),
};
