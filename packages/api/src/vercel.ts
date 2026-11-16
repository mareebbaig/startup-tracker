import "@st/worker/env.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";
import { connect } from "@st/worker/db.ts";
import { createApp, createAuthLayer } from "./app.ts";

/**
 * Vercel Function entry (bundled by scripts/build-vercel.mjs).
 * The Mongo connection is created once per warm instance and reused.
 */
let dataApp: Promise<Express> | null = null;
const getDataApp = () => {
  dataApp ??= connect()
    .then(({ db }) => createApp(db))
    .catch((err) => {
      dataApp = null; // retry on next request
      throw err;
    });
  return dataApp;
};

const app = createAuthLayer();
// only connect to Mongo after the login check passed
app.use(async (req, res, next) => {
  try {
    (await getDataApp())(req, res, next);
  } catch (err) {
    next(err);
  }
});
app.use((err: Error, _req: unknown, res: ServerResponse & { status?: unknown }, _next: unknown) => {
  console.error(err);
  res.statusCode = 500;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "server error" }));
});

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as never, res as never);
}
