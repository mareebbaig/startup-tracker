import { describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import type { Article } from "@st/shared";
import { upsertStartup } from "../src/db.ts";
import { extractRegex } from "../src/extract/regexExtractor.ts";

/** Tiny in-memory stand-in for the "startups" collection */
function fakeDb() {
  const docs: any[] = [];
  const col = {
    findOne: async (q: any) => docs.find((d) => d.normalizedName === q.normalizedName) ?? null,
    insertOne: async (d: any) => {
      docs.push({ ...d, _id: docs.length + 1 });
    },
    updateOne: async (q: any, u: any) => {
      const d = docs.find((x) => x._id === q._id);
      Object.assign(d, u.$set);
    },
  };
  return { db: { collection: () => col } as unknown as Db, docs };
}

const art = (title: string, url: string, date: string): Article => ({
  sourceId: "t", url, title, text: "", publishedAt: new Date(date), sourceCountry: "DE",
});

describe("dedupe (ADR-06)", () => {
  it("merges the same round from two sites", async () => {
    const { db, docs } = fakeDb();
    const a1 = art("Berliner Limetax sichert sich 36 Mio. EUR", "https://a.de/1", "2026-11-01");
    const a2 = art("Limetax GmbH holt 36 Millionen Euro", "https://b.de/2", "2026-11-03");
    expect(await upsertStartup(db, a1, extractRegex(a1))).toBe("created");
    expect(await upsertStartup(db, a2, extractRegex(a2))).toBe("merged");
    expect(docs).toHaveLength(1);
    expect(docs[0].rounds).toHaveLength(1);
    expect(docs[0].rounds[0].sources).toEqual(["https://a.de/1", "https://b.de/2"]);
    expect(docs[0].city).toBe("Berlin");
  });

  it("adds a new round months later", async () => {
    const { db, docs } = fakeDb();
    const a1 = art("Xyz sammelt 2 Mio. Euro Seed ein", "https://a.de/1", "2026-01-10");
    const a2 = art("Xyz sammelt 10 Mio. Euro Series A ein", "https://a.de/2", "2026-10-10");
    await upsertStartup(db, a1, extractRegex(a1));
    expect(await upsertStartup(db, a2, extractRegex(a2))).toBe("new_round");
    expect(docs[0].rounds.map((r: any) => r.round)).toEqual(["seed", "series-a"]);
  });
});
