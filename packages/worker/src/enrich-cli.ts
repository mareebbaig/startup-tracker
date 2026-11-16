import "./env.ts";
import type { Startup } from "@st/shared";
import { connect } from "./db.ts";
import { dueFilter, enrichAndSave } from "./enrich/enrich.ts";

/**
 * Usage:
 *   npm run enrich                  → up to 20 startups that are due
 *   npm run enrich -- --limit 50
 *   npm run enrich -- --name Langdock   (one startup, even if not due)
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const limit = Number(arg("limit") ?? 20);
  const name = arg("name");
  const { client, db } = await connect();
  try {
    const col = db.collection<Startup>("startups");
    const list = name
      ? await col.find({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }).toArray()
      : await col.find(dueFilter()).sort({ "rounds.announcedAt": -1 }).limit(limit).toArray();

    console.log(`Enriching ${list.length} startup(s)…`);
    for (const s of list) {
      try {
        const r = await enrichAndSave(db, s);
        const roles = r.careers?.roles ?? [];
        console.log(
          `✓ ${s.name}: site=${r.website ?? "-"} | roles=${roles.length} (dev ${roles.filter((x) => x.isDev).length}) | stack=${r.careers?.stack.join(",") || "-"} | contacts=${r.contacts.length}`,
        );
        for (const line of r.log) console.log(`    ${line}`);
      } catch (err) {
        console.warn(`✗ ${s.name}: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
