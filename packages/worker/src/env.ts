import { config } from "dotenv";
import { resolve } from "node:path";

// .env lives in the repo root (npm workspaces run scripts inside packages/worker)
config({ path: resolve(import.meta.dirname, "../../../.env") });
