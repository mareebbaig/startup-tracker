import * as cheerio from "cheerio";
import { normalizeName } from "@st/shared";
import { politeGet } from "./http.ts";

/** Domains that are never the startup's own website */
const IGNORE_HOSTS =
  /(^|\.)(linkedin|twitter|x|facebook|instagram|youtube|xing|tiktok|github|medium|crunchbase|dealroom|google|apple|wikipedia|bit|t|flipboard|whatsapp|pinterest|reddit|spotify|podcasts|amazon|eventbrite|calendly|typeform|mailchimp|substack|wordpress|gravatar|w3|schema|cloudflare|gstatic|googleapis|doubleclick|vimeo|sevenventures|startbase|deutsche-startups|munich-startup|eu-startups|tech|starting-up|gruenderszene|handelsblatt|businessinsider|techcrunch|sifted|heise|t3n|presseportal|prnewswire|businesswire)\.[a-z.]+$/i;

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Main part of a host: "app.langdock.com" → "langdock" */
function hostCore(host: string): string {
  const parts = host.split(".");
  return (parts.length >= 2 ? parts[parts.length - 2] : parts[0]).replace(/[^a-z0-9]/g, "");
}

/** How much does this host look like the company? 0..1 */
export function hostScore(host: string, companyName: string): number {
  const key = normalizeName(companyName);
  const core = hostCore(host);
  if (!key || !core) return 0;
  if (core === key) return 1;
  if (core === `get${key}` || core === `${key}app` || core === `${key}hq` || core === `try${key}` || core === `use${key}`) return 0.9;
  if (key.length >= 4 && (core.includes(key) || key.includes(core)) && core.length >= 4) return 0.7;
  const firstWord = normalizeName(companyName.split(" ")[0]);
  if (firstWord.length >= 4 && core === firstWord) return 0.8;
  return 0;
}

/** Best external link in an article that looks like the company's site. */
export function websiteFromArticleHtml(html: string, articleUrl: string, companyName: string): string | null {
  const $ = cheerio.load(html);
  const articleHost = hostOf(articleUrl);
  let best: { url: string; score: number } | null = null;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!/^https?:\/\//i.test(href)) return;
    const host = hostOf(href);
    if (!host || host === articleHost || IGNORE_HOSTS.test(host)) return;
    let score = hostScore(host, companyName);
    // link text = company name → strong hint
    const text = normalizeName($(el).text());
    if (score === 0 && text && text === normalizeName(companyName)) score = 0.75;
    if (score > 0 && (!best || score > best.score)) best = { url: `https://${host}`, score };
  });
  return best && (best as { score: number }).score >= 0.7 ? (best as { url: string }).url : null;
}

/** Does this page look like the company's homepage? */
export function pageMentionsCompany(html: string, companyName: string): boolean {
  const $ = cheerio.load(html);
  const head = `${$("title").text()} ${$('meta[property="og:site_name"]').attr("content") ?? ""} ${$('meta[name="description"]').attr("content") ?? ""}`;
  return normalizeName(head).includes(normalizeName(companyName)) || normalizeName($("h1").first().text()).includes(normalizeName(companyName));
}

/** Try "name.de", "name.com", … and keep the first that really looks like the company. */
export async function guessWebsite(companyName: string): Promise<string | null> {
  const key = normalizeName(companyName);
  if (key.length < 3) return null;
  const dashed = companyName.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const candidates = [...new Set([key, dashed])].flatMap((k) =>
    ["de", "com", "io", "ai", "app", "tech"].map((tld) => `https://${k}.${tld}`),
  );
  for (const url of candidates) {
    const res = await politeGet(url);
    if (res && pageMentionsCompany(res.body, companyName)) return `https://${hostOf(res.url) ?? hostOf(url)}`;
  }
  return null;
}
