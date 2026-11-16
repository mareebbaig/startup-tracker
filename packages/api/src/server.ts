import "@st/worker/env.ts";
import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { connect } from "@st/worker/db.ts";
import { createApp, createAuthLayer } from "./app.ts";

/** Local server: npm run dev (API only) or npm start (API + built UI) */
async function main() {
  const { db } = await connect();
  const app = createAuthLayer();
  app.use(createApp(db));

  const webDist = resolve(import.meta.dirname, "../../web/dist");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(resolve(webDist, "index.html")));
  }

  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    console.log(`API on http://localhost:${port}`);
    if (!process.env.APP_PASSWORD) console.log("(no APP_PASSWORD set → no login locally)");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
