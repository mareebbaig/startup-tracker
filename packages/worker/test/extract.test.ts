import { describe, expect, it } from "vitest";
import { normalizeName, type Article } from "@st/shared";
import { findAmount } from "../src/extract/amount.ts";
import { extractCompany } from "../src/extract/company.ts";
import { extractLocation } from "../src/extract/location.ts";
import { extractRound } from "../src/extract/round.ts";
import { extractRegex } from "../src/extract/regexExtractor.ts";
import { classify } from "../src/pipeline.ts";

describe("company name from headline", () => {
  const cases: [string, string][] = [
    ["Berliner KI-Plattform Langdock sammelt 3 Mio. USD ein", "Langdock"],
    ["deepeye Medical: Münchner HealthTech-Start-up sichert sich rund 2,5 Mio. Euro", "deepeye Medical"],
    ["Arztpraxis-Management-Plattform AlfaDocs.com sichert sich 2 Mio. Euro", "AlfaDocs.com"],
    ["Vom Suchschlitz zum autonomen Agenten: Aachener KI-Start-up amber sichert sich 7 Millionen Euro", "amber"],
    ["PLACED sichert sich 1,8 Mio. EUR", "PLACED"],
    ["Isar Aerospace: 270 Mio. EUR für Europas Raketen-Hoffnung", "Isar Aerospace"],
    ["Berliner Limetax sichert sich erfolgreich 36 Mio. EUR", "Limetax"],
    ["Münchner ConTech-Start-up oculai schließt 2,5 Mio. Euro Seed-Runde ab", "oculai"],
    ["mogenius: DevOps-Anbieter erhöht Seed-Runde auf 3 Mio. Euro", "mogenius"],
    ["KI-PropTech reltix sichert sich 3 Mio. Euro Pre-Seed", "reltix"],
    ["experial: DeepTech-Start-up sichert sich 2 Mio.-Euro-Finanzierung", "experial"],
    ["SaaS-Start-up CERPRO sichert sich rund 2 Mio. € Pre-Seed-Finanzierung", "CERPRO"],
    ["Pre-Seed-Finanzierung: Finches sichert sich 2 Mio. EUR", "Finches"],
    ["2,6 Mio. Euro für Blockchain-Start-up authentic.network", "authentic.network"],
    ["RegTech Certivity sichert sich 13,3 Mio.-Euro-Series-A-Finanzierung", "Certivity"],
    ["NexDash: 5 Mio. € Finanzierung für „Green Logistics made in Europe“", "NexDash"],
    ["Scenarium AI: 1,6 Mio. Euro Investment für Berliner KI-Start-up", "Scenarium AI"],
    ["Millionen-Seed für CoTrainer: Gelingt der Angriff auf den Amateurfußball-Markt?", "CoTrainer"],
    ["Munich AI Startup Calliora Raises €5.3 Million for Hospital Billing", "Calliora"],
    ["Health-AI startup Dehaze raises €3.2 million for chronic disease detection", "Dehaze"],
    ["kausable Raises 12 Million Euros in Seed Funding", "kausable"],
    ["telli Secures $15 Million in Seed Funding", "telli"],
    ["Hansetherm Receives 10 Million Euros in Seed Funding", "Hansetherm"],
    ["Tendos raises €12M seed round, topping 99% of German enterprise software peers", "Tendos"],
  ];
  it.each(cases)("%s → %s", (title, expected) => {
    expect(extractCompany(title)).toBe(expected);
  });
});

describe("amount", () => {
  const cases: [string, number, string][] = [
    ["sammelt 3 Mio. USD ein", 3_000_000, "USD"],
    ["rund 2,5 Mio. Euro", 2_500_000, "EUR"],
    ["13,3 Mio.-Euro-Series-A", 13_300_000, "EUR"],
    ["7 Millionen Euro", 7_000_000, "EUR"],
    ["1,8 Mio. EUR", 1_800_000, "EUR"],
    ["rund 2 Mio. € Pre-Seed", 2_000_000, "EUR"],
    ["Raises €5.3 Million", 5_300_000, "EUR"],
    ["Secures $15 Million", 15_000_000, "USD"],
    ["raises €12M seed round", 12_000_000, "EUR"],
    ["12 Million Euros in Seed", 12_000_000, "EUR"],
    ["über drei Millionen Euro", 3_000_000, "EUR"],
    ["in Höhe von einer Million Euro", 1_000_000, "EUR"],
    ["sammelt 750.000 Euro ein", 750_000, "EUR"],
    ["rund 13. Mio. Euro Finanzierung", 13_000_000, "EUR"],
  ];
  it.each(cases)("%s", (text, amount, currency) => {
    const m = findAmount(text);
    expect(m?.amount).toBeCloseTo(amount);
    expect(m?.currency).toBe(currency);
  });
  it("no amount", () => expect(findAmount("Millionen-Seed für CoTrainer")).toBeNull());
});

describe("round", () => {
  it.each([
    ["KI-PropTech reltix sichert sich 3 Mio. Euro Pre-Seed", "pre-seed"],
    ["oculai schließt 2,5 Mio. Euro Seed-Runde ab", "seed"],
    ["Certivity sichert sich 13,3 Mio.-Euro-Series-A-Finanzierung", "series-a"],
    ["Isar Aerospace: Series-D-Finanzierungsrunde", "series-c+"],
    ["PLACED sichert sich 1,8 Mio. EUR", "unknown"],
  ])("%s → %s", (title, round) => expect(extractRound(title, "")).toBe(round));
});

describe("location", () => {
  it("German city adjective", () => expect(extractLocation("Berliner Limetax sichert sich 36 Mio. EUR", "").city).toBe("Berlin"));
  it("English city", () => expect(extractLocation("Munich AI Startup Calliora Raises €5.3 Million", "").city).toBe("München"));
  it("foreign", () => expect(extractLocation("Paris-based Mistral raises €600M", "The French startup").country).toBe("FOREIGN"));
  it("unknown", () => expect(extractLocation("PLACED sichert sich 1,8 Mio. EUR", "").country).toBe("UNKNOWN"));
});

describe("normalizeName", () => {
  it.each([
    ["Placed Technologie GmbH", "placedtechnologie"],
    ["AlfaDocs.com", "alfadocs"],
    ["amber (ehem. amberSearch)", "amber"],
    ["Münchner Kindl AG", "muenchnerkindl"],
  ])("%s → %s", (input, out) => expect(normalizeName(input)).toBe(out));
});

const article = (title: string, text = "", sourceCountry: "DE" | "INTL" = "DE"): Article => ({
  sourceId: "test", url: "https://example.com/" + encodeURIComponent(title), title, text,
  publishedAt: new Date("2026-11-10"), sourceCountry,
});

describe("full pipeline (classify)", () => {
  it("saves a clear German tech round", () => {
    const a = article("Berliner KI-Plattform Langdock sammelt 3 Mio. USD ein", "Lead-Investoren sind General Catalyst und La Famiglia.");
    const x = extractRegex(a);
    expect(classify(a, x)).toBe("saved");
    expect(x.isTech).toBe(true);
    expect(x.investors).toEqual(expect.arrayContaining(["General Catalyst", "La Famiglia"]));
  });
  it("drops rounds under €500k", () => {
    const a = article("Kölner Start-up Xyz sammelt 300.000 Euro ein");
    expect(classify(a, extractRegex(a))).toBe("too_small");
  });
  it("drops acquisitions", () => {
    const a = article("Personio übernimmt Berliner Fintech Circula");
    expect(classify(a, extractRegex(a))).toBe("not_funding");
  });
  it("drops foreign startups from international feeds", () => {
    const a = article("Stockholm-based Legora raises $550M", "The Swedish legal AI startup", "INTL");
    expect(classify(a, extractRegex(a))).toBe("not_germany");
  });
  it("keeps unknown-location items from German feeds", () => {
    const a = article("PLACED sichert sich 1,8 Mio. EUR", "Staffing-KI");
    expect(classify(a, extractRegex(a))).toBe("saved");
  });
  it("sends unclear headlines to review", () => {
    const a = article("Robco Achieves Unicorn Status and Raises New Capital", "Munich robotics company");
    expect(classify(a, extractRegex(a))).toBe("needs_review");
  });
});

describe("fixes from first real check-feeds run (2026-11-16)", () => {
  it.each([
    ["Germany’s NeuralSat raises €2.9 million to build a high-speed data network in space", "NeuralSat"],
    ["Ukrainian defencetech UFORCE raises $700M Series A at $6B valuation", "UFORCE"],
    ["Amsterdam’s VectorY Therapeutics raises €74.5 million to tackle ALS", "VectorY Therapeutics"],
    ["SoftBank leads $500M funding round in Agile Robots", "Agile Robots"],
    ["sennder will mit 228 Millionen Euro weiter wachsen", "sennder"],
    ["Münchner Elektroflugzeug-Startup Vaeridion sichert sich 124,5 Millionen Euro", "Vaeridion"],
    ["Berlin-LA startup Opdo raises $2.3M to automate optical engineering with AI", "Opdo"],
    ["#Exklusiv - Xyz sammelt 5 Millionen Euro ein", "Xyz"],
  ])("%s → %s", (title, expected) => {
    expect(extractRegex(article(title)).company).toBe(expected);
  });

  it.each([
    "Deutscher Eigenkapitaltag: Entschlossen trotz Kapitalmangel",
    "Busse ohne Fahrer: TUM startet Millionenprojekt",
    "#StartupTicker - +++ seed+speed Ventures +++ FinTech +++ Noctua Science Ventures +++ sennder +++",
    "#Portfolio - Von About You bis FINN – so investiert SevenVentures",
    "Weekly funding round-up! All of the European startup funding rounds we tracked this week",
  ])("not a funding round: %s", (title) => {
    const a = article(title, "Millionen Euro Investoren Kapital");
    expect(classify(a, extractRegex(a))).toBe("not_funding");
  });

  it("electric aircraft + energy platforms count as tech", () => {
    expect(extractRegex(article("Münchner Elektroflugzeug-Startup Vaeridion sichert sich 124,5 Millionen Euro")).isTech).toBe(true);
    expect(extractRegex(article("Feld Energy erhält über 6 Millionen Euro und startet Investitionsplattform")).isTech).toBe(true);
  });

  it("€6B is 6 billion", () => expect(findAmount("startups raise €6B in October")?.amount).toBe(6e9));
});
