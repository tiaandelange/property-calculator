import path from "path";
import dotenv from "dotenv";

/**
 * Backend environment loader (`process.env` only — never `import.meta.env`).
 *
 * ## Variable classes (Supabase + Vercel migration)
 *
 * ### Server-only secrets (must NEVER appear in `frontend/` or any `VITE_*` key)
 * These belong in `backend/.env`, Render/Railway/Vercel **server** env, or CI secrets:
 * - `DATABASE_URL` — Postgres for Prisma (until decommissioned).
 * - `JWT_SECRET` — legacy app JWT signing + HMAC download URLs (until retired).
 * - `SUPABASE_JWT_SECRET` — verifies Supabase access tokens on Express during the **legacy bridge**
 *   (`resolveBearerUser`). Still server-only; not bundled to the SPA.
 * - `SUPABASE_SERVICE_ROLE_KEY` — Supabase **service_role**; **bypasses RLS**. Use only in trusted
 *   backend/serverless code (`src/config/supabaseClient.ts`). **Never** import into the frontend.
 * - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe server API + webhook verification.
 *
 * ### Server public / non-secret (still backend `process.env`, not Vite)
 * - `SUPABASE_URL` — same project URL as the SPA; safe to expose in the bundle, but we read it
 *   on the server for `createClient` with the service role. The browser uses `VITE_SUPABASE_URL`.
 * - `SUPABASE_ANON_KEY` — optional on Express for future **RLS-respecting** server calls with a user JWT.
 *   **Browser-safe only when paired with RLS** — the anon key alone does not protect data; policies do.
 *   The SPA must use **only** `VITE_SUPABASE_ANON_KEY`, never the service role.
 *
 * ### Frontend (Vite) — see `frontend/.env.example`
 * Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Supabase. Every `VITE_*` value is public
 * in the built JS bundle.
 *
 * ## Dotenv file precedence (development only)
 *
 * Files listed earlier WIN — once a key is set, later files cannot overwrite
 * it (because we pass `override: false`):
 *
 *   1. .env.[NODE_ENV].local   (mode-specific + always-local; never committed)
 *   2. .env.[NODE_ENV]         (mode-specific; only .env.example variants committed)
 *   3. .env.local              (always-local; never committed)
 *   4. .env                    (baseline; only .env.example committed)
 *
 * In production we DO NOT load `.env*` files at all — the platform (Render,
 * Railway, Vercel server, etc.) injects env vars directly into the process.
 * Anything read from disk in production would either be a noop or a misconfiguration smell.
 */
const nodeEnv = process.env.NODE_ENV ?? "development";
const isProductionEnv = nodeEnv === "production";

if (!isProductionEnv) {
  const candidates = [
    `.env.${nodeEnv}.local`,
    `.env.${nodeEnv}`,
    ".env.local",
    ".env"
  ];
  for (const file of candidates) {
    dotenv.config({ path: path.resolve(process.cwd(), file), override: false });
  }
}

const DEV_JWT_SECRET_FALLBACK = "unsafe-dev-secret";

/**
 * Strings that are obviously not a real secret. Refusing them in production
 * stops an accidental ".env.example -> .env -> deploy" copy from issuing
 * forgeable tokens.
 */
const KNOWN_PLACEHOLDER_JWT_SECRETS = new Set<string>([
  DEV_JWT_SECRET_FALLBACK,
  "change-this-secret",
  "secret",
  "changeme",
  ""
]);

function resolveJwtSecret(): string {
  const raw = process.env.JWT_SECRET;
  if (isProductionEnv) {
    if (!raw || KNOWN_PLACEHOLDER_JWT_SECRETS.has(raw)) {
      throw new Error(
        "JWT_SECRET is required in production and must not be a default placeholder. " +
          "Set a strong random value (>= 32 chars) before starting the server."
      );
    }
    if (raw.length < 32) {
      throw new Error(
        "JWT_SECRET must be at least 32 characters in production. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"."
      );
    }
    return raw;
  }
  return raw ?? DEV_JWT_SECRET_FALLBACK;
}

/**
 * Build the list of allowed CORS origins.
 *
 * Two env vars are honoured (in order):
 *   - `FRONTEND_URLS` — comma-separated allow-list. Use this in production to
 *     authorise multiple origins (e.g. your custom domain + Vercel preview
 *     deployments).
 *   - `FRONTEND_URL`  — single origin. Kept for backwards compatibility and
 *     for the local dev story (`http://localhost:5173`).
 *
 * Falsy / blank entries are discarded so a stray comma cannot accidentally
 * authorise the empty string (`""`), which the browser sends for some
 * file:// or data: URL contexts.
 */
function resolveAllowedOrigins(): string[] {
  const csv = process.env.FRONTEND_URLS?.trim();
  if (csv) {
    return csv
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  const single = process.env.FRONTEND_URL?.trim();
  if (single) return [single];
  return ["http://localhost:5173"];
}

/**
 * `trust proxy` is the count of upstream proxy hops Express should peel off
 * when computing `req.ip` / `req.protocol`. The default of 1 covers the
 * typical production topology:
 *   client → Cloudflare → Render/Railway → backend container
 * where Render/Railway is the LAST hop before the app and adds the
 * X-Forwarded-* headers we want to trust.
 *
 * Overriding via TRUST_PROXY is useful for setups with extra L7 proxies
 * in front (e.g. an internal nginx) — set it to the number of hops you trust.
 *
 * Setting it to `true` (or a value higher than the actual hop count) lets
 * any client spoof `X-Forwarded-For` and bypass IP-based rate limiting.
 */
function resolveTrustProxy(): number | false {
  const raw = process.env.TRUST_PROXY?.trim();
  if (raw === undefined || raw === "") {
    return isProductionEnv ? 1 : false;
  }
  if (raw === "false" || raw === "0") return false;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0) return n;
  return isProductionEnv ? 1 : false;
}

export const env = {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT ?? 4000),
  JWT_SECRET: resolveJwtSecret(),
  /**
   * Supabase Dashboard → Settings → API → JWT Secret (signs access tokens).
   * Required for Express to accept `Authorization: Bearer <supabase access_token>`.
   */
  SUPABASE_JWT_SECRET: (process.env.SUPABASE_JWT_SECRET ?? "").trim(),
  /** Supabase project URL (Settings → API → Project URL). */
  SUPABASE_URL: (process.env.SUPABASE_URL ?? "").trim(),
  /**
   * Supabase **anon** public key (Settings → API → Project API keys → `anon`).
   * Optional on the Express server today; reserved for future server-side calls that must respect RLS.
   */
  SUPABASE_ANON_KEY: (process.env.SUPABASE_ANON_KEY ?? "").trim(),
  /**
   * Supabase **service role** secret (Settings → API → `service_role`).
   * Bypasses RLS — backend only; never commit real values. Used by `src/config/supabaseClient.ts`.
   */
  SUPABASE_SERVICE_ROLE_KEY: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
  // Short-lived tokens by default: shrinks the window in which a stolen JWT
  // (e.g. via a future XSS bug or leaked log line) remains usable. Override with
  // JWT_EXPIRES_IN if a longer session is genuinely required.
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "1h",
  /**
   * @deprecated for consumer code — read `ALLOWED_ORIGINS` instead.
   *             Kept here so existing imports keep compiling.
   */
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
  ALLOWED_ORIGINS: resolveAllowedOrigins(),
  TRUST_PROXY: resolveTrustProxy(),
  /**
   * Stripe **secret** API key (`sk_…`). **Server-only** — never in `VITE_*` or frontend code.
   * Used by `subscriptionRoutes` for Checkout; omit in dev to use mock checkout.
   */
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  /**
   * Stripe webhook signing secret (`whsec_…`). **Server-only** — raw body verification on POST `/api/subscription/webhook`.
   */
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? ""
};

export const isProduction = isProductionEnv;
