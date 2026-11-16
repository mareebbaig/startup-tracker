import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";

/**
 * Simple password login (one user = me).
 * - APP_PASSWORD set   → every /api route needs the session cookie
 * - APP_PASSWORD unset → open locally, but refused on Vercel (never deploy without a password)
 */
const COOKIE = "st_session";
const MAX_AGE_S = 30 * 24 * 3600;

const token = (password: string) => createHmac("sha256", password).update("startup-tracker-session-v1").digest("hex");

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

const isProd = () => Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

export function isLoggedIn(req: Request, password = process.env.APP_PASSWORD): boolean {
  if (!password) return !isProd();
  const c = readCookie(req, COOKIE);
  return Boolean(c && safeEqual(c, token(password)));
}

export function authRouter(): Router {
  const r = Router();

  r.get("/api/session", (req, res) => {
    res.json({ required: Boolean(process.env.APP_PASSWORD) || isProd(), loggedIn: isLoggedIn(req) });
  });

  r.post("/api/login", async (req, res) => {
    const password = process.env.APP_PASSWORD;
    if (!password) return void res.status(503).json({ error: "APP_PASSWORD is not set on the server" });
    const given = String(req.body?.password ?? "");
    if (!safeEqual(token(given), token(password))) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return void res.status(401).json({ error: "Wrong password" });
    }
    const secure = isProd() ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${COOKIE}=${token(password)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_S}${secure}`);
    res.json({ ok: true });
  });

  r.post("/api/logout", (_req, res) => {
    res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    res.json({ ok: true });
  });

  return r;
}

/** Blocks every other /api route unless logged in */
export function requireLogin(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) return next();
  if (isProd() && !process.env.APP_PASSWORD) return void res.status(503).json({ error: "APP_PASSWORD is not set on the server" });
  if (!isLoggedIn(req)) return void res.status(401).json({ error: "login required" });
  next();
}
