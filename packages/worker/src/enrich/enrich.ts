import * as cheerio from "cheerio";
import type { Db } from "mongodb";
import { computeMatch, findStack, normalizeName, type Careers, type Contact, type Startup } from "@st/shared";
import { fetchBoard, findBoardInHtml, findCareersLink, guessBoard, parseCareersHtml, type BoardJobs, type BoardRef } from "./ats.ts";
import { extractFounders } from "./founders.ts";
import { politeGet } from "./http.ts";
import { guessWebsite, websiteFromArticleHtml } from "./website.ts";

/** Re-check careers after this many days */
export const RECHECK_DAYS = 7;

export interface EnrichResult {
  website?: string;
  careers?: Careers;
  contacts: Contact[];
  log: string[];
}

const pageText = (html: string) => {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, noscript").remove();
  return $("article").text() || $("main").text() || $("body").text();
};

/**
 * Steps (each one optional — we keep whatever we find):
 *  1. Read the news articles → company website link + founder names
 *  2. No link? Guess name.de / name.com / …
 *  3. Homepage → job-board link (Personio, Greenhouse, …) or careers page
 *  4. Careers page → job-board link, or read job titles from HTML
 *  5. Nothing yet? Try the name as slug on job boards (marked "not verified")
 *  6. Job texts → stack keywords → match score
 */
export async function enrichStartup(s: Startup): Promise<EnrichResult> {
  const log: string[] = [];
  const contacts: Contact[] = [];
  let website = s.website;

  // 1. articles
  const sources = [...new Set(s.rounds.flatMap((r) => r.sources))].slice(0, 3);
  for (const src of sources) {
    const page = await politeGet(src);
    if (!page) {
      log.push(`article not reachable: ${src}`);
      continue;
    }
    if (!website) website = websiteFromArticleHtml(page.body, src, s.name) ?? undefined;
    contacts.push(...extractFounders(pageText(page.body), src));
  }
  if (website) log.push(`website from article: ${website}`);

  // 2. guess
  if (!website) {
    website = (await guessWebsite(s.name)) ?? undefined;
    log.push(website ? `website guessed: ${website}` : "website not found");
  }

  let board: BoardRef | null = null;
  let jobs: BoardJobs | null = null;
  let careersUrl: string | undefined;
  let verified = true;

  // 3. homepage
  if (website) {
    const home = await politeGet(website);
    if (home) {
      board = findBoardInHtml(home.body);
      careersUrl = findCareersLink(home.body, home.url) ?? undefined;
      // 4. careers page
      if (!board && careersUrl) {
        const cp = await politeGet(careersUrl);
        if (cp) {
          board = findBoardInHtml(cp.body);
          if (!board) {
            jobs = parseCareersHtml(cp.body, cp.url);
            log.push(`careers page read: ${jobs.roles.length} roles`);
          }
        }
      }
    } else log.push(`homepage not reachable: ${website}`);
  }

  if (board) {
    jobs = await fetchBoard(board);
    log.push(`job board ${board.ats}/${board.slug}: ${jobs?.roles.length ?? "error"} roles`);
  }

  // 5. guess the board
  if (!jobs || (jobs.roles.length === 0 && !board)) {
    const host = website ? new URL(website).hostname.replace(/^www\./, "").split(".")[0] : undefined;
    const slugs = [...new Set([host, normalizeName(s.name), s.name.toLowerCase().replace(/\s+/g, "-")].filter(Boolean) as string[])];
    const guessed = await guessBoard(slugs);
    if (guessed) {
      board = guessed;
      jobs = guessed;
      verified = false;
      log.push(`job board guessed ${guessed.ats}/${guessed.slug}: ${guessed.roles.length} roles (not verified)`);
    }
  }

  // 6. stack + careers record
  let careers: Careers | undefined;
  if (jobs || careersUrl) {
    careers = {
      url: board?.url ?? careersUrl,
      ats: board?.ats ?? (jobs ? "html" : undefined),
      slug: board?.slug,
      verified,
      roles: jobs?.roles ?? [],
      stack: jobs ? findStack(jobs.text) : [],
      checkedAt: new Date(),
    };
  }

  // dedupe contacts by name
  const uniq = new Map(contacts.map((c) => [c.name, c]));
  return { website, careers, contacts: [...uniq.values()].slice(0, 6), log };
}

/** Enrich + save. */
export async function enrichAndSave(db: Db, s: Startup): Promise<EnrichResult> {
  const col = db.collection<Startup>("startups");
  try {
    const r = await enrichStartup(s);
    const lastRound = s.rounds.map((x) => x.announcedAt).sort((a, b) => b.getTime() - a.getTime())[0];
    const match = computeMatch(r.careers?.roles ?? [], r.careers?.stack ?? [], lastRound);
    await col.updateOne(
      { _id: s._id as never },
      {
        $set: {
          website: r.website ?? s.website,
          careers: r.careers ?? s.careers,
          contacts: r.contacts.length ? r.contacts : s.contacts,
          match,
          enrichedAt: new Date(),
        },
        $unset: { enrichError: "" },
      },
    );
    return r;
  } catch (err) {
    await col.updateOne({ _id: s._id as never }, { $set: { enrichedAt: new Date(), enrichError: (err as Error).message } });
    throw err;
  }
}

/** Which startups need enrichment: never done, or older than RECHECK_DAYS. Tech first, newest first. */
export function dueFilter(now = new Date()) {
  const cutoff = new Date(now.getTime() - RECHECK_DAYS * 86_400_000);
  return { isTech: true, $or: [{ enrichedAt: { $exists: false } }, { enrichedAt: { $lt: cutoff } }] };
}
