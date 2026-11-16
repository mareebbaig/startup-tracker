import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createAuthLayer } from "../src/app.ts";

let server: Server;
let base = "";
const env = { ...process.env };

beforeAll(async () => {
  process.env.APP_PASSWORD = "s3cret";
  const app = createAuthLayer();
  app.get("/api/data", (_req, res) => res.json({ secret: 42 }));
  await new Promise<void>((r) => (server = app.listen(0, () => r())));
  base = `http://localhost:${(server.address() as { port: number }).port}`;
});
afterAll(() => {
  server.close();
  process.env = env;
});

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("password login", () => {
  it("blocks data without login", async () => {
    expect((await fetch(base + "/api/data")).status).toBe(401);
  });
  it("rejects a wrong password", async () => {
    expect((await post("/api/login", { password: "wrong" })).status).toBe(401);
  });
  it("lets you in with the right password", async () => {
    const r = await post("/api/login", { password: "s3cret" });
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    const data = await fetch(base + "/api/data", { headers: { cookie } });
    expect(await data.json()).toEqual({ secret: 42 });
  });
  it("rejects a made-up cookie", async () => {
    expect((await fetch(base + "/api/data", { headers: { cookie: "st_session=abc" } })).status).toBe(401);
  });
});
