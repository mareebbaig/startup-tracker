import express, { type NextFunction, type Request, type Response } from "express";
import { ObjectId, type Db } from "mongodb";
import type { Article, OutreachStatus, Startup } from "@st/shared";
import { upsertStartup } from "@st/worker/db.ts";
import { enrichAndSave } from "@st/worker/enrich/enrich.ts";
import type { Extraction } from "@st/worker/extract/regexExtractor.ts";
import { authRouter, requireLogin } from "./auth.ts";
import { buildListQuery, STATUSES, type ListParams } from "./query.ts";

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

/** Login routes + guard. Works without a DB connection. */
export function createAuthLayer() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use(authRouter());
  app.use(requireLogin);
  return app;
}

/** All data routes. Mount after createAuthLayer(). */
export function createApp(db: Db) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  const startups = db.collection<Startup>("startups");
  const review = db.collection("review");

  // ---------- startups ----------
  app.get("/api/startups", async (req, res) => {
    const { filter, sort } = buildListQuery(req.query as ListParams);
    const list = await startups.find(filter).sort(sort).limit(500).toArray();
    res.json(list);
  });

  app.get("/api/startups/:id", async (req, res) => {
    const _id = oid(req.params.id);
    const s = _id && (await startups.findOne({ _id }));
    if (!s) return void res.status(404).json({ error: "not found" });
    res.json(s);
  });

  /** Update outreach status / notes / website */
  app.patch("/api/startups/:id", async (req, res) => {
    const _id = oid(req.params.id);
    if (!_id) return void res.status(400).json({ error: "bad id" });
    const { status, notes, website } = req.body as { status?: OutreachStatus; notes?: string; website?: string };
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (status) {
      if (!STATUSES.includes(status)) return void res.status(400).json({ error: "bad status" });
      set["outreach.status"] = status;
      if (status === "contacted") set["outreach.contactedAt"] = new Date();
    }
    if (typeof notes === "string") set["outreach.notes"] = notes.slice(0, 5000);
    if (typeof website === "string") set.website = website.trim() || undefined;
    const r = await startups.findOneAndUpdate({ _id }, { $set: set }, { returnDocument: "after" });
    if (!r) return void res.status(404).json({ error: "not found" });
    res.json(r);
  });

  /** Run enrichment now for one startup */
  app.post("/api/startups/:id/enrich", async (req, res) => {
    const _id = oid(req.params.id);
    const s = _id && (await startups.findOne({ _id }));
    if (!s) return void res.status(404).json({ error: "not found" });
    const r = await enrichAndSave(db, s);
    res.json({ startup: await startups.findOne({ _id: _id! }), log: r.log });
  });

  // ---------- filters + stats ----------
  app.get("/api/meta", async (_req, res) => {
    const [cities, sectors] = await Promise.all([
      startups.distinct("city", { isTech: true }),
      startups.distinct("sectors", { isTech: true }),
    ]);
    const lastRun = await db.collection("articles").find().sort({ processedAt: -1 }).limit(1).next();
    const byStatus = await startups
      .aggregate<{ _id: string; n: number }>([{ $match: { isTech: true } }, { $group: { _id: "$outreach.status", n: { $sum: 1 } } }])
      .toArray();
    res.json({
      cities: cities.filter(Boolean).sort(),
      sectors: sectors.filter(Boolean).sort(),
      statuses: STATUSES,
      byStatus: Object.fromEntries(byStatus.map((x) => [x._id, x.n])),
      reviewOpen: await review.countDocuments({ resolved: { $ne: true } }),
      lastRunAt: lastRun?.processedAt ?? null,
    });
  });

  // ---------- review (headlines the regex couldn't read) ----------
  app.get("/api/review", async (_req, res) => {
    res.json(await review.find({ resolved: { $ne: true } }).sort({ publishedAt: -1 }).limit(200).toArray());
  });

  /** Save a review item as a startup, with the name typed in by hand */
  app.post("/api/review/:id/accept", async (req, res) => {
    const _id = oid(req.params.id);
    const item = _id && (await review.findOne({ _id }));
    const name = String(req.body?.name ?? "").trim();
    if (!item) return void res.status(404).json({ error: "not found" });
    if (!name) return void res.status(400).json({ error: "name required" });
    const x = { ...(item.extraction as Extraction), company: name, confidence: 1 };
    const article: Article = { sourceId: "review", url: item.url, title: item.title, text: "", publishedAt: new Date(item.publishedAt), sourceCountry: "DE" };
    const result = await upsertStartup(db, article, x);
    await review.updateOne({ _id: _id! }, { $set: { resolved: true, resolvedAs: name, resolvedAt: new Date() } });
    await db.collection("articles").updateOne({ url: item.url }, { $set: { status: "saved", company: name } });
    res.json({ result });
  });

  app.post("/api/review/:id/dismiss", async (req, res) => {
    const _id = oid(req.params.id);
    if (!_id) return void res.status(400).json({ error: "bad id" });
    await review.updateOne({ _id }, { $set: { resolved: true, resolvedAs: null, resolvedAt: new Date() } });
    res.json({ ok: true });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });
  return app;
}
