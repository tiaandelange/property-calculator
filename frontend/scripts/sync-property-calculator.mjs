/**
 * Keeps frontend/shared/propertyCalculator in sync with the repo-root canonical copy.
 * Runs on `npm run build` so Vercel (Root Directory = frontend) can bundle report PDF API code.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const src = path.resolve(frontendRoot, "../shared/propertyCalculator");
const dest = path.resolve(frontendRoot, "api/lib/propertyCalculator");

if (!existsSync(src)) {
  console.error("[sync-property-calculator] Missing source:", src);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(path.dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.info("[sync-property-calculator] synced →", dest);
