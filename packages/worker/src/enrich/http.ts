import { USER_AGENT } from "../config/feeds.ts";

/** Polite HTTP: 1 request/sec per host, robots.txt respected, timeout, size cap (ADR-12). */

const PER_HOST_DELAY_MS = 1000;
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;

const lastHit = new Map<string, number>();
const robotsCache = new Map<string, string[]>(); // host → disallowed path prefixes

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitTurn(host: string) {
  const last = lastHit.get(host) ?? 0;
  const wait = last + PER_HOST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

/** Very small robots.txt reader: only "User-agent: *" + Disallow lines. */
export function parseRobots(txt: string): string[] {
  const out: string[] = [];
  let applies = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, key, value] = m;
    if (key.toLowerCase() === "user-agent") applies = value.trim() === "*";
    else if (applies && key.toLowerCase() === "disallow" && value.trim()) out.push(value.trim());
  }
  return out;
}

async function allowedByRobots(url: URL): Promise<boolean> {
  let rules = robotsCache.get(url.host);
  if (!rules) {
    rules = [];
    try {
      await waitTurn(url.host);
      const res = await fetch(`${url.protocol}//${url.host}/robots.txt`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) rules = parseRobots(await res.text());
    } catch {
      /* no robots.txt → allowed */
    }
    robotsCache.set(url.host, rules);
  }
  return !rules.some((p) => p === "/" || url.pathname.startsWith(p.replace(/\*.*$/, "")));
}

export interface FetchResult {
  url: string; // final URL after redirects
  status: number;
  body: string;
}

/** GET a page. Returns null on any error / blocked / non-2xx. */
export async function politeGet(url: string, opts: { accept?: string; skipRobots?: boolean } = {}): Promise<FetchResult | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!opts.skipRobots && !(await allowedByRobots(u))) return null;
  await waitTurn(u.host);
  try {
    const res = await fetch(u, {
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: opts.accept ?? "text/html,application/xhtml+xml,*/*;q=0.8" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return null;
    const body = (await res.text()).slice(0, MAX_BYTES);
    return { url: res.url || url, status: res.status, body };
  } catch {
    return null;
  }
}

/** For public job-board APIs (JSON). */
export async function getJson<T>(url: string): Promise<T | null> {
  const r = await politeGet(url, { accept: "application/json", skipRobots: true });
  if (!r) return null;
  try {
    return JSON.parse(r.body) as T;
  } catch {
    return null;
  }
}
