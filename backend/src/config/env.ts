import dotenv from "dotenv";
dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProductionEnv = nodeEnv === "production";

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
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? ""
};

export const isProduction = isProductionEnv;
