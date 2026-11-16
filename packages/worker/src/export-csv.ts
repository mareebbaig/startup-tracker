import "./env.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Startup } from "@st/shared";
import { connect } from "./db.ts";

/**
 * Tech startups → data/startups.csv (newest round first).
 * Usage: npm run export            (tech only)
 *        npm run export -- --all   (include non-tech)
 */
const esc = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const all = process.argv.includes("--all");
  const { client, db } = await connect();
  try {
    const startups = await db
      .collection<Startup>("startups")
      .find(all ? {} : { isTech: true })
      .sort({ "rounds.announcedAt": -1 })
      .toArray();

    const header = ["name", "city", "round", "amount_eur", "date", "sectors", "investors", "status", "sources"];
    const rows = startups.map((s) => {
      const r = [...s.rounds].sort((a, b) => b.announcedAt.getTime() - a.announcedAt.getTime())[0];
      return [
        s.name,
        s.city,
        r?.round,
        r?.amountEur,
        r?.announcedAt.toISOString().slice(0, 10),
        s.sectors.join(" "),
        r?.investors.join(" | "),
        s.outreach.status,
        r?.sources.join(" "),
      ].map(esc).join(",");
    });

    // repo root /data (gitignored)
    const dir = resolve(import.meta.dirname, "../../../data");
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, "startups.csv");
    writeFileSync(file, "﻿" + [header.join(","), ...rows].join("\n"), "utf8"); // BOM → Excel shows umlauts
    console.log(`Wrote ${rows.length} startups → ${file}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
