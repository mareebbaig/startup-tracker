import type { OutreachStatus, Startup } from "@st/shared";

/** Dates arrive as strings over JSON */
export type S = Startup & { _id: string };

export interface Meta {
  cities: string[];
  sectors: string[];
  statuses: OutreachStatus[];
  byStatus: Partial<Record<OutreachStatus, number>>;
  reviewOpen: number;
  lastRunAt: string | null;
}

export interface ReviewItem {
  _id: string;
  url: string;
  title: string;
  publishedAt: string;
  extraction: { company: string | null; amountEur?: number; round: string; location: { city?: string } };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

export const api = {
  list: (params: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return call<S[]>(`/api/startups?${qs}`);
  },
  update: (id: string, body: { status?: OutreachStatus; notes?: string; website?: string }) =>
    call<S>(`/api/startups/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  enrich: (id: string) => call<{ startup: S; log: string[] }>(`/api/startups/${id}/enrich`, { method: "POST" }),
  meta: () => call<Meta>("/api/meta"),
  review: () => call<ReviewItem[]>("/api/review"),
  accept: (id: string, name: string) => call(`/api/review/${id}/accept`, { method: "POST", body: JSON.stringify({ name }) }),
  dismiss: (id: string) => call(`/api/review/${id}/dismiss`, { method: "POST" }),
};

// ---------- small formatters ----------

export function eur(n?: number): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1e9) return `€${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `€${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  return `€${Math.round(n / 1e3)}k`;
}

export function date(d?: string | Date): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function ago(d?: string | Date | null): string {
  if (!d) return "never";
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 60) return `${min} min ago`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h ago`;
  return `${Math.round(min / 1440)} days ago`;
}

/** Latest funding round */
export function lastRound(s: S) {
  return [...s.rounds].sort((a, b) => new Date(b.announcedAt).getTime() - new Date(a.announcedAt).getTime())[0];
}

export const ROUND_LABEL: Record<string, string> = {
  "pre-seed": "Pre-Seed",
  seed: "Seed",
  "series-a": "Series A",
  "series-b": "Series B",
  "series-c+": "Series C+",
  growth: "Growth",
  unknown: "—",
};
