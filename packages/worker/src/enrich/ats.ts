import * as cheerio from "cheerio";
import { isDevRole, type Ats, type JobRole } from "@st/shared";
import { getJson, politeGet } from "./http.ts";

/** A job board we found: which system + the company's slug on it */
export interface BoardRef {
  ats: Ats;
  slug: string;
  url: string;
}

export interface BoardJobs {
  roles: JobRole[];
  /** title + description text of all jobs, for stack detection */
  text: string;
}

/** Known job-board URL shapes → slug */
const BOARD_PATTERNS: { ats: Ats; re: RegExp; url: (slug: string) => string }[] = [
  { ats: "personio", re: /https?:\/\/([a-z0-9-]+)\.jobs\.personio\.(?:de|com)/i, url: (s) => `https://${s}.jobs.personio.de` },
  { ats: "greenhouse", re: /https?:\/\/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i, url: (s) => `https://boards.greenhouse.io/${s}` },
  { ats: "lever", re: /https?:\/\/jobs\.(?:eu\.)?lever\.co\/([a-z0-9_-]+)/i, url: (s) => `https://jobs.lever.co/${s}` },
  { ats: "ashby", re: /https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/i, url: (s) => `https://jobs.ashbyhq.com/${s}` },
  { ats: "recruitee", re: /https?:\/\/([a-z0-9-]+)\.recruitee\.com/i, url: (s) => `https://${s}.recruitee.com` },
  { ats: "join", re: /https?:\/\/join\.com\/companies\/([a-z0-9_-]+)/i, url: (s) => `https://join.com/companies/${s}` },
  { ats: "workable", re: /https?:\/\/apply\.workable\.com\/([a-z0-9_-]+)/i, url: (s) => `https://apply.workable.com/${s}` },
];

const IGNORE_SLUGS = new Set(["api", "embed", "www", "jobs", "js", "static", "assets"]);

/** Find a job-board link anywhere in an HTML page (links, iframes, scripts). */
export function findBoardInHtml(html: string): BoardRef | null {
  for (const p of BOARD_PATTERNS) {
    const m = p.re.exec(html);
    if (m && !IGNORE_SLUGS.has(m[1].toLowerCase())) return { ats: p.ats, slug: m[1], url: p.url(m[1]) };
  }
  return null;
}

const stripHtml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

function role(title: string, url?: string, location?: string): JobRole {
  return { title: title.trim(), url, location: location?.trim() || undefined, isDev: isDevRole(title) };
}

// ---------- one reader per job board ----------

export function parsePersonioXml(xml: string, slug: string): BoardJobs {
  const $ = cheerio.load(xml, { xml: true });
  const roles: JobRole[] = [];
  let text = "";
  $("position").each((_, el) => {
    const p = $(el);
    const title = p.children("name").text();
    const id = p.children("id").text().trim();
    roles.push(role(title, id ? `https://${slug}.jobs.personio.de/job/${id}` : undefined, p.children("office").text()));
    text += ` ${title} ${p.find("jobDescription value").text()} ${p.find("keywords").text()}`;
  });
  return { roles, text: stripHtml(text) };
}

async function personio(slug: string): Promise<BoardJobs | null> {
  const r = await politeGet(`https://${slug}.jobs.personio.de/xml?language=en`, { accept: "application/xml", skipRobots: true });
  if (!r || !r.body.includes("<workzag-jobs")) return null;
  return parsePersonioXml(r.body, slug);
}

async function greenhouse(slug: string): Promise<BoardJobs | null> {
  const d = await getJson<{ jobs?: { title: string; absolute_url: string; location?: { name: string }; content?: string }[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  );
  if (!d?.jobs) return null;
  return {
    roles: d.jobs.map((j) => role(j.title, j.absolute_url, j.location?.name)),
    text: stripHtml(d.jobs.map((j) => `${j.title} ${j.content ?? ""}`).join(" ")),
  };
}

async function lever(slug: string): Promise<BoardJobs | null> {
  const d = await getJson<{ text: string; hostedUrl: string; categories?: { location?: string }; descriptionPlain?: string; lists?: { content: string }[] }[]>(
    `https://api.lever.co/v0/postings/${slug}?mode=json`,
  );
  if (!Array.isArray(d)) return null;
  return {
    roles: d.map((j) => role(j.text, j.hostedUrl, j.categories?.location)),
    text: stripHtml(d.map((j) => `${j.text} ${j.descriptionPlain ?? ""} ${(j.lists ?? []).map((l) => l.content).join(" ")}`).join(" ")),
  };
}

async function ashby(slug: string): Promise<BoardJobs | null> {
  const d = await getJson<{ jobs?: { title: string; jobUrl: string; location?: string; descriptionPlain?: string }[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
  );
  if (!d?.jobs) return null;
  return {
    roles: d.jobs.map((j) => role(j.title, j.jobUrl, j.location)),
    text: d.jobs.map((j) => `${j.title} ${j.descriptionPlain ?? ""}`).join(" "),
  };
}

async function recruitee(slug: string): Promise<BoardJobs | null> {
  const d = await getJson<{ offers?: { title: string; careers_url: string; location?: string; description?: string; requirements?: string }[] }>(
    `https://${slug}.recruitee.com/api/offers/`,
  );
  if (!d?.offers) return null;
  return {
    roles: d.offers.map((j) => role(j.title, j.careers_url, j.location)),
    text: stripHtml(d.offers.map((j) => `${j.title} ${j.description ?? ""} ${j.requirements ?? ""}`).join(" ")),
  };
}

/** JOIN and Workable have no simple public API → read the board page HTML */
async function boardPage(url: string): Promise<BoardJobs | null> {
  const r = await politeGet(url);
  return r ? parseCareersHtml(r.body, r.url) : null;
}

export async function fetchBoard(ref: BoardRef): Promise<BoardJobs | null> {
  switch (ref.ats) {
    case "personio": return personio(ref.slug);
    case "greenhouse": return greenhouse(ref.slug);
    case "lever": return lever(ref.slug);
    case "ashby": return ashby(ref.slug);
    case "recruitee": return recruitee(ref.slug);
    default: return boardPage(ref.url);
  }
}

/** No board link found → try the company name as slug on the boards with an API. */
export async function guessBoard(slugs: string[]): Promise<(BoardRef & BoardJobs) | null> {
  for (const slug of slugs.filter((s) => s.length >= 4)) {
    for (const ats of ["personio", "greenhouse", "lever", "ashby", "recruitee"] as const) {
      const p = BOARD_PATTERNS.find((b) => b.ats === ats)!;
      const jobs = await fetchBoard({ ats, slug, url: p.url(slug) });
      if (jobs && jobs.roles.length > 0) return { ats, slug, url: p.url(slug), ...jobs };
    }
  }
  return null;
}

// ---------- plain careers page (no job board) ----------

const ROLE_WORDS =
  /\b(engineer|developer|entwickler|manager|lead|head of|designer|scientist|analyst|architect|specialist|consultant|werkstudent|working student|intern|praktikum|praktikant|sales|marketing|operations|account|recruiter|officer|director)\b/i;

/** Job titles from a careers page: short link/heading texts that look like roles. */
export function parseCareersHtml(html: string, pageUrl: string): BoardJobs {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();
  const seen = new Set<string>();
  const roles: JobRole[] = [];
  $("a, h2, h3, h4, li").each((_, el) => {
    const t = $(el).clone().children("span.meta, small").remove().end().text().replace(/\s+/g, " ").trim();
    if (t.length < 6 || t.length > 90 || !ROLE_WORDS.test(t) || seen.has(t.toLowerCase())) return;
    if (/\b(alle|all|view|ansehen|mehr|more|apply|bewerben|jobs?|karriere|careers?)\b\s*$/i.test(t) && t.split(" ").length <= 3) return;
    seen.add(t.toLowerCase());
    const href = $(el).is("a") ? $(el).attr("href") : $(el).find("a").attr("href");
    let url: string | undefined;
    try {
      url = href ? new URL(href, pageUrl).toString() : undefined;
    } catch {
      url = undefined;
    }
    roles.push(role(t, url));
  });
  return { roles: roles.slice(0, 50), text: $("body").text().replace(/\s+/g, " ") };
}

/** Link to the careers page from a homepage */
export function findCareersLink(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  let found: string | null = null;
  $("a[href]").each((_, el) => {
    if (found) return;
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().trim().toLowerCase();
    if (/\/(careers?|jobs?|karriere|stellenangebote|join-us|joinus|work-with-us)(\/|$|\?|#|\.html)/i.test(href) || /^(careers?|jobs?|karriere|join us|we'?re hiring|offene stellen|stellenangebote)$/i.test(text)) {
      try {
        found = new URL(href, baseUrl).toString();
      } catch {
        /* bad href */
      }
    }
  });
  return found;
}
