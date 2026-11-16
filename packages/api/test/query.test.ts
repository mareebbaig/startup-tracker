import { describe, expect, it } from "vitest";
import { buildListQuery } from "../src/query.ts";

const now = new Date("2026-11-16T00:00:00Z");

describe("buildListQuery", () => {
  it("defaults: tech only, hide archived, newest first", () => {
    const { filter, sort } = buildListQuery({}, now);
    expect(filter).toEqual({ $and: [{ isTech: true }, { "outreach.status": { $ne: "archived" } }] });
    expect(sort).toEqual({ "rounds.announcedAt": -1 });
  });

  it("all filters", () => {
    const { filter, sort } = buildListQuery(
      { q: "lang.dock", city: "Berlin", round: "seed", status: "contacted", minAmount: "1000000", days: "30", minScore: "50", hiring: "1", dev: "1", tech: "all", sort: "score" },
      now,
    );
    expect(filter).toEqual({
      $and: [
        { name: { $regex: "lang\\.dock", $options: "i" } },
        { city: "Berlin" },
        { "rounds.round": "seed" },
        { "outreach.status": "contacted" },
        { "rounds.amountEur": { $gte: 1_000_000 } },
        { "rounds.announcedAt": { $gte: new Date("2026-10-17T00:00:00Z") } },
        { "match.score": { $gte: 50 } },
        { "match.hiring": true },
        { "match.devRoles": { $gt: 0 } },
      ],
    });
    expect(sort).toEqual({ "match.score": -1, "rounds.announcedAt": -1 });
  });

  it("ignores bad values", () => {
    const { filter } = buildListQuery({ status: "hacked", minAmount: "abc", tech: "all" }, now);
    expect(filter).toEqual({ $and: [{ "outreach.status": { $ne: "archived" } }] });
  });
});
