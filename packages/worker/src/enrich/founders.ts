import type { Contact } from "@st/shared";

/** "Max Mustermann", "Léon Alexander Bamesreiter", "Jan-Oliver Horstmann" */
const NAME = String.raw`([\p{Lu}][\p{Ll}]+(?:-[\p{Lu}][\p{Ll}]+)?(?:\s+(?:von\s+|van\s+|de\s+)?[\p{Lu}][\p{Ll}]+(?:-[\p{Lu}][\p{Ll}]+)?){1,2})`;

/** 1–4 names joined by "," / "und" / "and" */
const NAMES = String.raw`${NAME}(?:(?:\s*,\s*|\s+(?:und|and|sowie)\s+)${NAME}){0,3}`;

const PATTERNS: { re: RegExp; role: string }[] = [
  // "gegründet von A, B und C" / "founded by A and B" / "Gründer A und B" (no i-flag: names must start uppercase)
  { re: new RegExp(String.raw`(?:[Gg]egründet (?:\d{4} )?von|[Ff]ounded (?:in \d{4} )?by|[Gg]ründer(?:innen|in|n)?|[Cc]o-?[Ff]ounders?|[Ff]ounders?)\s*:?\s+(${NAMES})`, "gu"), role: "Founder" },
  // "wurde 2021 von A, B und C gegründet"
  { re: new RegExp(String.raw`\bvon\s+(${NAMES})\s+gegründet`, "gu"), role: "Founder" },
  // "CEO Max Mustermann" / "Max Mustermann, CEO"
  { re: new RegExp(String.raw`\b(?:CEO|Geschäftsführer(?:in)?)\s+${NAME}`, "gu"), role: "CEO" },
  { re: new RegExp(String.raw`\bCTO\s+${NAME}`, "gu"), role: "CTO" },
  { re: new RegExp(String.raw`${NAME},?\s+(?:CEO|Mitgründer|Co-Founder|Gründer)\b`, "gu"), role: "Founder" },
  { re: new RegExp(String.raw`${NAME},?\s+(?:CTO)\b`, "gu"), role: "CTO" },
];

const NOT_A_NAME = /\b(Start|Startup|Series|Seed|Euro|Millionen|Venture|Capital|Partners|Fund|Investor|Berlin|München|Hamburg|Germany|Deutschland|Gründer|Founder|Unternehmen|Die|Der|Das|The)\b/;

/** Founder / CEO / CTO names from article text. Only public press info, kept minimal (ADR-12). */
export function extractFounders(text: string, sourceUrl: string): Contact[] {
  const out = new Map<string, Contact>();
  for (const { re, role } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const chunk = m[1];
      const names = chunk.split(/\s*,\s*|\s+(?:und|and|sowie)\s+/);
      for (const n of names) {
        const name = n.trim();
        if (name.split(/\s+/).length < 2 || NOT_A_NAME.test(name) || name.length > 40) continue;
        const prev = out.get(name);
        // keep the more specific role (CTO/CEO beats Founder)
        if (!prev || prev.role === "Founder") out.set(name, { name, role: prev && role === "Founder" ? prev.role : role, source: sourceUrl });
      }
    }
  }
  return [...out.values()].slice(0, 6);
}
