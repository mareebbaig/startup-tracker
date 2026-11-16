/** sector tag → keywords. Tags in TECH_TAGS make a startup "tech". */
const SECTORS: Record<string, RegExp> = {
  ai: /\b(ki|ai|künstliche intelligenz|artificial intelligence|machine learning|llm|genai|generative|agentic|ki-gestützt)\b/i,
  saas: /(\bsaas\b|software|plattform|platform|\bcloud\b|\bapi\b|no-code|low-code)/i,
  fintech: /\b(fintech|regtech|insurtech|payments?|zahlungs\w*|banking|neobank|krypto|crypto|blockchain|web3)\b/i,
  devtools: /\b(devops|developer|entwickler-?tools?|devtools|open[- ]source|kubernetes|infrastructure)\b/i,
  data: /\b(data|daten\w*|analytics|datenplattform)\b/i,
  cyber: /\b(cyber\w*|security|it-sicherheit|sicherheitssoftware)\b/i,
  robotics: /\b(robotik|robotics|roboter|robots?|drohnen?|drones?|autonom\w*)\b/i,
  deeptech: /\b(deep-?tech|quanten\w*|quantum|halbleiter\w*|semiconductor|photonik|photonics|newspace|raumfahrt|aerospace|space|elektroflug\w*|e-?flugzeug\w*|aviation|luftfahrt|satellit\w*|satellite)\b/i,
  proptech: /\b(proptech|contech|construction-?tech|bautech)\b/i,
  healthtech: /\b(healthtech|health-?ai|medtech|digital health|e-health|telemedizin|gesundheitsplattform)\b/i,
  edtech: /\b(edtech|e-learning|lernplattform)\b/i,
  hrtech: /\b(hr-?tech|recruiting|staffing|personal-?software)\b/i,
  mobility: /\b(mobility|mobilität|e-mobility|logistics-?tech|logistik-?software)\b/i,
  climatetech: /\b(climate-?tech|cleantech|greentech|energie-?software|battery|batterie\w*|energy|energie\w*|solar\w*|wasserstoff|hydrogen)\b/i,
  apps: /\b(app|apps|web-?app|mobile app)\b/i,
  // not counted as tech (but stored as tag)
  biotech: /\b(biotech|pharma|wirkstoff\w*|clinical|klinisch\w*|therap\w*)\b/i,
  consumer: /\b(mode|fashion|food|lebensmittel|getränk\w*|kosmetik|beauty|möbel)\b/i,
};

/** Not counted as tech on their own: biotech, consumer, and pure energy/climate without software */
const NON_TECH = new Set(["biotech", "consumer"]);

export function extractSectors(title: string, text: string): { sectors: string[]; isTech: boolean } {
  const all = `${title}\n${text}`;
  const sectors = Object.entries(SECTORS)
    .filter(([, re]) => re.test(all))
    .map(([tag]) => tag);
  // Also catch compound words like "KI-Start-up", "SaaS-Start-up", "FinTech-Startup"
  if (/\b(ki|ai)-/i.test(all) && !sectors.includes("ai")) sectors.push("ai");
  const isTech = sectors.some((s) => !NON_TECH.has(s));
  return { sectors, isTech };
}
