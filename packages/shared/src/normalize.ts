const LEGAL_FORMS =
  /\b(gmbh\s*&\s*co\.?\s*kg|gmbh|ug|ag|se|kg|ohg|gbr|e\.?\s?v\.?|inc\.?|ltd\.?|llc|co\.?|corp\.?)\s*$/i;

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/**
 * Company name → stable key for dedupe.
 * "Placed Technologie GmbH" → "placedtechnologie"
 * "AlfaDocs.com" → "alfadocs"
 * "amber (ehem. amberSearch)" → "amber"
 */
export function normalizeName(name: string): string {
  let s = name.toLowerCase().trim();
  s = s.replace(/\(.*?\)/g, " "); // drop "(ehem. ...)"
  s = s.replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c);
  s = s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  // strip legal forms (repeat: "xyz technologies gmbh & co. kg")
  for (let i = 0; i < 3; i++) s = s.trim().replace(LEGAL_FORMS, "");
  s = s.trim().replace(/\.(com|de|io|ai|net|org|app|co|eu|tech)$/, "");
  return s.replace(/[^a-z0-9]/g, "");
}
