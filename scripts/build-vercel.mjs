// Builds the app for Vercel using the Build Output API v3:
//   .vercel/output/static/            ← React UI (vite build)
//   .vercel/output/functions/api.func ← Express API bundled into one file
//   .vercel/output/config.json        ← routes: /api/* → function, everything else → UI
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, ".vercel/output");
const fn = resolve(out, "functions/api.func");

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

// 1. UI
execSync("npm run build -w @st/web", { stdio: "inherit", cwd: root });
cpSync(resolve(root, "packages/web/dist"), resolve(out, "static"), { recursive: true });

// 2. API → one ESM file (all deps bundled, so no node_modules needed)
await build({
  entryPoints: [resolve(root, "packages/api/src/vercel.ts")],
  outfile: resolve(fn, "index.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  minify: false,
  sourcemap: false,
  // optional MongoDB extras we don't use (loaded with try/catch by the driver)
  external: [
    "kerberos", "@mongodb-js/zstd", "@aws-sdk/credential-providers", "gcp-metadata", "snappy",
    "socks", "aws4", "mongodb-client-encryption",
  ],
  // CommonJS packages (express) need `require` inside an ESM bundle
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "info",
});

writeFileSync(
  resolve(fn, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", maxDuration: 300 }, null, 2),
);

// 3. Routes
writeFileSync(
  resolve(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/api(/.*)?$", dest: "/api" },
        { handle: "filesystem" },
        { src: "^/(.*)$", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log("\n✓ Vercel output ready in .vercel/output");
