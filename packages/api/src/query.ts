import type { Filter, Sort } from "mongodb";
import type { OutreachStatus, Startup } from "@st/shared";

/** Query string from the UI → MongoDB filter + sort. Pure → easy to test. */
export interface ListParams {
  q?: string;
  city?: string;
  round?: string;
  sector?: string;
  status?: string;
  /** min amount in EUR */
  minAmount?: string;
  /** only rounds in the last N days */
  days?: string;
  minScore?: string;
  /** "1" = has open roles */
  hiring?: string;
  /** "1" = has dev roles */
  dev?: string;
  /** "all" = include non-tech */
  tech?: string;
  sort?: "newest" | "amount" | "score" | "name";
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const num = (s?: string) => (s && !Number.isNaN(Number(s)) ? Number(s) : undefined);

export const STATUSES: OutreachStatus[] = ["new", "shortlisted", "contacted", "replied", "applied", "deal", "archived"];

export function buildListQuery(p: ListParams, now = new Date()): { filter: Filter<Startup>; sort: Sort } {
  const and: Filter<Startup>[] = [];

  if (p.tech !== "all") and.push({ isTech: true });
  if (p.q?.trim()) and.push({ name: { $regex: esc(p.q.trim()), $options: "i" } });
  if (p.city) and.push({ city: p.city });
  if (p.round) and.push({ "rounds.round": p.round } as Filter<Startup>);
  if (p.sector) and.push({ sectors: p.sector });

  if (p.status && STATUSES.includes(p.status as OutreachStatus)) and.push({ "outreach.status": p.status } as Filter<Startup>);
  // hide archived unless asked for
  else and.push({ "outreach.status": { $ne: "archived" } } as Filter<Startup>);

  const minAmount = num(p.minAmount);
  if (minAmount) and.push({ "rounds.amountEur": { $gte: minAmount } } as Filter<Startup>);

  const days = num(p.days);
  if (days) and.push({ "rounds.announcedAt": { $gte: new Date(now.getTime() - days * 86_400_000) } } as Filter<Startup>);

  const minScore = num(p.minScore);
  if (minScore) and.push({ "match.score": { $gte: minScore } } as Filter<Startup>);

  if (p.hiring === "1") and.push({ "match.hiring": true } as Filter<Startup>);
  if (p.dev === "1") and.push({ "match.devRoles": { $gt: 0 } } as Filter<Startup>);

  const sorts: Record<string, Sort> = {
    newest: { "rounds.announcedAt": -1 },
    amount: { "rounds.amountEur": -1 },
    score: { "match.score": -1, "rounds.announcedAt": -1 },
    name: { normalizedName: 1 },
  };

  return { filter: and.length ? { $and: and } : {}, sort: sorts[p.sort ?? "newest"] ?? sorts.newest };
}
