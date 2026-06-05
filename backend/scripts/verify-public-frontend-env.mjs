/**
 * Fails the process if forbidden server-only tokens appear under `frontend/src`.
 * Run from repo root or `backend/` via `npm run verify:public-env` in backend.
 *
 * Safe to run in CI: no network, read-only.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** `backend/scripts` → repo root */
const repoRoot = join(__dirname, "..", "..");
const frontendSrc = join(repoRoot, "frontend", "src");

try {
  if (!statSync(frontendSrc).isDirectory()) throw new Error("not a directory");
} catch {
  console.error("[verify-public-frontend-env] frontend/src not found at", frontendSrc);
  process.exit(1);
}

/** Substrings that must never appear in bundled frontend source. */
const FORBIDDEN = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PAYSTACK_SECRET_KEY",
  "SUPABASE_JWT_SECRET"
];

/** VITE_ payment/billing secrets must never be defined for the SPA bundle. */
const FORBIDDEN_VITE_PAYMENT_PREFIXES = [
  "VITE_PAYSTACK",
  "VITE_BILLING",
  "VITE_STRIPE_SECRET"
];

function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name.name) && !name.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

let failed = false;
for (const file of walk(frontendSrc)) {
  const text = readFileSync(file, "utf8");
  for (const token of FORBIDDEN) {
    if (text.includes(token)) {
      console.error(`[verify-public-frontend-env] Forbidden token "${token}" appears in: ${file}`);
      failed = true;
    }
  }
  for (const prefix of FORBIDDEN_VITE_PAYMENT_PREFIXES) {
    if (text.includes(prefix)) {
      console.error(`[verify-public-frontend-env] Forbidden payment secret prefix "${prefix}" appears in: ${file}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error(
    "[verify-public-frontend-env] Server-only secrets must live in backend / Vercel server env only. See docs/MIGRATION_STATUS.md."
  );
  process.exit(1);
}

console.log("[verify-public-frontend-env] OK — no forbidden server-only tokens in frontend/src.");
