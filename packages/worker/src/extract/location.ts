/** canonical city → words that point to it (name, adjective, English name) */
const CITIES: Record<string, string[]> = {
  Berlin: ["Berlin", "Berliner", "Berlin-based"],
  München: ["München", "Muenchen", "Munich", "Münchner", "Muenchner", "Munich-based"],
  Hamburg: ["Hamburg", "Hamburger", "Hamburg-based"],
  Köln: ["Köln", "Koeln", "Cologne", "Kölner", "Koelner", "Cologne-based"],
  Frankfurt: ["Frankfurt", "Frankfurter", "Frankfurt-based"],
  Düsseldorf: ["Düsseldorf", "Duesseldorf", "Düsseldorfer", "Duesseldorfer", "Düsseldorf-based"],
  Stuttgart: ["Stuttgart", "Stuttgarter", "Stuttgart-based"],
  Leipzig: ["Leipzig", "Leipziger"],
  Dresden: ["Dresden", "Dresdner"],
  Aachen: ["Aachen", "Aachener"],
  Karlsruhe: ["Karlsruhe", "Karlsruher"],
  Darmstadt: ["Darmstadt", "Darmstädter"],
  Heidelberg: ["Heidelberg", "Heidelberger"],
  Mannheim: ["Mannheim", "Mannheimer"],
  Nürnberg: ["Nürnberg", "Nuremberg", "Nürnberger"],
  Hannover: ["Hannover", "Hanover", "Hannoveraner"],
  Bremen: ["Bremen", "Bremer"],
  Bonn: ["Bonn", "Bonner"],
  Potsdam: ["Potsdam", "Potsdamer"],
  Chemnitz: ["Chemnitz", "Chemnitzer"],
  Magdeburg: ["Magdeburg", "Magdeburger"],
  Regensburg: ["Regensburg", "Regensburger"],
  Würzburg: ["Würzburg", "Würzburger"],
  Fulda: ["Fulda", "Fuldaer"],
  Kassel: ["Kassel", "Kasseler"],
  Mainz: ["Mainz", "Mainzer"],
  Wiesbaden: ["Wiesbaden", "Wiesbadener"],
  Freiburg: ["Freiburg", "Freiburger"],
  Augsburg: ["Augsburg", "Augsburger"],
  Ulm: ["Ulm", "Ulmer"],
  Jena: ["Jena", "Jenaer"],
  Erlangen: ["Erlangen", "Erlanger"],
  Paderborn: ["Paderborn", "Paderborner"],
  Dortmund: ["Dortmund", "Dortmunder"],
  Essen: ["Essener"], // "Essen" alone also means "food"
  Bochum: ["Bochum", "Bochumer"],
  Münster: ["Münster", "Münsteraner"],
  Kiel: ["Kiel", "Kieler"],
  Lübeck: ["Lübeck", "Lübecker"],
  Rostock: ["Rostock", "Rostocker"],
  Saarbrücken: ["Saarbrücken", "Saarbrücker"],
  Braunschweig: ["Braunschweig", "Braunschweiger"],
  Göttingen: ["Göttingen", "Göttinger"],
  Bielefeld: ["Bielefeld", "Bielefelder"],
  Osnabrück: ["Osnabrück", "Osnabrücker"],
  Oldenburg: ["Oldenburg", "Oldenburger"],
  Ingolstadt: ["Ingolstadt", "Ingolstädter"],
  Wolfsburg: ["Wolfsburg", "Wolfsburger"],
  Kaiserslautern: ["Kaiserslautern"],
  Tübingen: ["Tübingen", "Tübinger"],
  Konstanz: ["Konstanz", "Konstanzer"],
  Garching: ["Garching"],
};

const GERMANY = ["Germany", "German", "Deutschland", "deutsches", "deutsche", "deutscher"];

const FOREIGN = [
  "Wien", "Vienna", "Wiener", "Österreich", "Austria", "Austrian", "österreichische",
  "Zürich", "Zurich", "Zürcher", "Schweiz", "Switzerland", "Swiss", "Schweizer",
  "Paris", "France", "French", "London", "British", "UK-based", "Stockholm", "Sweden", "Swedish",
  "Amsterdam", "Dutch", "Netherlands", "Madrid", "Barcelona", "Spain", "Spanish", "Lisbon",
  "Portugal", "Portuguese", "Milan", "Italy", "Italian", "Warsaw", "Poland", "Polish",
  "Helsinki", "Finland", "Finnish", "Copenhagen", "Denmark", "Danish", "Oslo", "Norway",
  "Norwegian", "Tallinn", "Estonia", "Estonian", "Dublin", "Ireland", "Irish", "Brussels",
  "Belgium", "Belgian", "Prague", "Czech", "Budapest", "Bucharest", "Romania", "Sofia",
  "Bulgaria", "Athens", "Greece", "Greek", "Riga", "Latvia", "Vilnius", "Lithuania",
  "Ljubljana", "Slovenia", "Zagreb", "Croatia", "Belgrade", "Kyiv", "Ukraine", "Ukrainian",
  "Tel Aviv", "Israel", "Israeli", "New York", "San Francisco", "US-based", "Silicon Valley",
];

function wordRegex(words: string[]): RegExp {
  const esc = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // letter-aware boundaries (works with umlauts)
  return new RegExp(`(?<![\\p{L}\\p{N}])(${esc})(?![\\p{L}\\p{N}])`, "u");
}

const CITY_RES = Object.entries(CITIES).map(([city, words]) => ({ city, re: wordRegex(words) }));
const GERMANY_RE = wordRegex(GERMANY);
const FOREIGN_RE = wordRegex(FOREIGN);

export interface Location {
  city?: string;
  country: "DE" | "FOREIGN" | "UNKNOWN";
}

function firstCity(s: string): string | undefined {
  let best: { city: string; idx: number } | undefined;
  for (const { city, re } of CITY_RES) {
    const m = re.exec(s);
    if (m && (!best || m.index < best.idx)) best = { city, idx: m.index };
  }
  return best?.city;
}

export function extractLocation(title: string, text: string): Location {
  const city = firstCity(title) ?? firstCity(text);
  if (city) return { city, country: "DE" };
  const all = `${title}\n${text}`;
  const foreign = FOREIGN_RE.test(all);
  if (GERMANY_RE.test(all) && !FOREIGN_RE.test(title)) return { country: "DE" };
  if (foreign) return { country: "FOREIGN" };
  return { country: "UNKNOWN" };
}

/** Is this word a city word? (used by company-name extraction to skip "Berliner" etc.) */
const CITY_WORDS = new Set(Object.values(CITIES).flat().map((w) => w.toLowerCase()));

export function isCityWord(token: string): boolean {
  const t = token.replace(/[^\p{L}-]/gu, "").toLowerCase();
  return CITY_WORDS.has(t) || /-based$/.test(t);
}
