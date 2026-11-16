import { isCityWord } from "./location.ts";

/** Verbs that sit right after the company name in funding headlines */
const VERB_RE =
  /(?<![\p{L}])(sammelt|sammeln|sichert(?:\s+sich)?|sichern|erhält|erhalten|holt|holen|schließt|schliesst|bekommt|landet|erhöht|wirbt|raises|raised|secures|secured|receives|received|closes|closed|lands|landed|bags|nabs|snags|grabs|gets|banks|will\s+mit)(?![\p{L}])/iu;

/** Words that describe the company but are not its name */
const DESCRIPTOR_END =
  /(start-?up|startups?|plattform|platform|anbieter|unternehmen|company|scale-?up|spezialist|provider|firma|softwarefirma|entwickler|developer|maker|hersteller|tech|software|saas)$/i;

const SECTOR_WORDS = new Set([
  "regtech", "proptech", "contech", "healthtech", "fintech", "insurtech", "legaltech", "edtech",
  "deeptech", "deep-tech", "cleantech", "climatetech", "foodtech", "sporttech", "sport-tech",
  "medtech", "hrtech", "mobility", "saas", "b2b", "software", "robotics", "robotik", "newspace",
  "biotech", "health-ai", "ki-proptech", "blockchain", "cybersecurity", "logistik", "logistics",
  "defencetech", "defensetech", "defence", "defense", "spacetech", "agritech", "agtech", "climate",
]);

/** Nationality / place words in front of a name: "Ukrainian defencetech UFORCE", "Germany's NeuralSat" */
const PLACE_WORDS = new Set([
  "german", "germany", "europe", "european", "ukrainian", "czech", "polish", "french", "british", "uk",
  "dutch", "swedish", "danish", "finnish", "norwegian", "spanish", "italian", "austrian", "swiss",
  "estonian", "irish", "belgian", "portuguese", "greek", "romanian", "bulgarian", "israeli", "us",
  "american", "amsterdam", "paris", "london", "stockholm", "vienna", "zurich", "berlin-la",
]);

const STOPWORDS = new Set([
  "der", "die", "das", "dem", "den", "des", "ein", "eine", "einer", "und", "mit", "von", "vom",
  "für", "fuer", "jetzt", "nun", "auch", "the", "a", "an", "and", "with", "from", "for", "now",
  "also", "german", "germany's", "deutsche", "deutsches", "europäische", "european",
]);

function clean(s: string): string {
  return s
    .replace(/(\p{L})['’]s(?=\s)/gu, "$1s") // Germany’s → Germanys (handled as place word)
    .replace(/[„“”"«»‚‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDescriptor(token: string): boolean {
  const t = token.toLowerCase().replace(/[^\p{L}\p{N}.\-&]/gu, "");
  if (!t) return true;
  if (STOPWORDS.has(t) || SECTOR_WORDS.has(t)) return true;
  if (isCityWord(token)) return true;
  // possessive place: "Germany’s", "Amsterdam’s" (apostrophe may be gone → "Germanys")
  const base = t.replace(/['’]s$/, "");
  if (PLACE_WORDS.has(base) || PLACE_WORDS.has(t)) return true;
  if (/s$/.test(t) && (PLACE_WORDS.has(t.slice(0, -1)) || isCityWord(t.slice(0, -1)))) return true;
  // compounds: "KI-Start-up", "HealthTech-Start-up", "Arztpraxis-Management-Plattform", "DevOps-Anbieter"
  if (t.includes("-") && DESCRIPTOR_END.test(t)) return true;
  if (/^(start-?up|startups?|plattform|platform|anbieter|unternehmen|company|scale-?up)$/.test(t)) return true;
  return false;
}

/** Walk back from the end of `before` and collect name tokens until a descriptor. */
function trailingName(before: string): string | null {
  const tokens = clean(before).split(" ").filter(Boolean);
  const name: string[] = [];
  for (let i = tokens.length - 1; i >= 0 && name.length < 4; i--) {
    if (isDescriptor(tokens[i])) break;
    name.unshift(tokens[i]);
  }
  const s = name.join(" ").replace(/[,:;]+$/, "").trim();
  if (!s || /^\d/.test(s) || s.length > 50) return null;
  return s;
}

function fromVerb(seg: string): string | null {
  const m = VERB_RE.exec(seg);
  if (!m) return null;
  return trailingName(seg.slice(0, m.index));
}

const FUNDINGISH = /finanzierung|investment|seed|series|runde|round|funding|mio\.?|million|millionen|€|\$|\d/i;

/** "2,6 Mio. Euro für Blockchain-Start-up authentic.network" → "authentic.network" */
function fromFuer(seg: string): string | null {
  const m = /\b(?:für|fuer|for)\s+(.+)$/i.exec(seg);
  if (!m) return null;
  const tokens = clean(m[1]).split(" ");
  // name = tokens after the last descriptor
  let start = 0;
  tokens.forEach((t, i) => {
    if (isDescriptor(t)) start = i + 1;
  });
  const s = tokens.slice(start, start + 4).join(" ").trim();
  return s && !/^\d/.test(s) ? s : null;
}

/** "SoftBank leads $500M funding round in Agile Robots" → "Agile Robots" */
function fromRoundIn(seg: string): string | null {
  const m = /\b(?:round|runde|investment|funding|beteiligung)\s+(?:in|into|for|at|bei|an)\s+(.+)$/i.exec(clean(seg));
  if (!m) return null;
  const s = m[1].split(/\s+(?:to|for|um|zur|zum|mit|with)\s+/i)[0].split(" ").slice(0, 4).join(" ").trim();
  return s && !/^\d/.test(s) ? s : null;
}

/**
 * Company name from a funding headline.
 * Examples:
 *   "Berliner KI-Plattform Langdock sammelt 3 Mio. USD ein" → "Langdock"
 *   "deepeye Medical: Münchner HealthTech-Start-up sichert sich …" → "deepeye Medical"
 *   "Munich AI Startup Calliora Raises €5.3 Million" → "Calliora"
 */
export function extractCompany(title: string): string | null {
  const t = clean(title);
  const colon = t.indexOf(":");
  if (colon > 0) {
    const left = t.slice(0, colon).trim();
    const right = t.slice(colon + 1).trim();
    const viaVerb = fromVerb(right) ?? fromVerb(left);
    if (viaVerb) return viaVerb;
    // "NexDash: 5 Mio. € Finanzierung …", "Isar Aerospace: 270 Mio. EUR …"
    const words = left.split(" ");
    if (words.length <= 4 && !FUNDINGISH.test(left)) return left;
    return fromFuer(left) ?? fromFuer(right);
  }
  return fromRoundIn(t) ?? fromVerb(t) ?? fromFuer(t);
}
