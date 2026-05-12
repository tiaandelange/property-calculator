import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";

/**
 * Rate limiters for the public auth surface.
 *
 * Every limiter:
 *   - emits standard `RateLimit-*` headers (RFC draft) so clients / CDNs can
 *     react cooperatively,
 *   - is keyed by the request IP plus a normalised email (when present) so a
 *     single IP that probes many emails does not slip below the per-key cap,
 *   - is disabled while running unit/integration tests so existing test suites
 *     are not throttled.
 *
 * If we later move behind a proxy / load balancer remember to set
 * `app.set("trust proxy", 1)` so `req.ip` reflects the real client IP rather
 * than the proxy.
 */

const isTest = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

function emailIpKey(req: { ip?: string; ips?: string[]; body?: any }): string {
  const ipFromExpress = req.ip || req.ips?.[0] || "unknown";
  const ip = ipKeyGenerator(ipFromExpress);
  const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return rawEmail ? `${ip}:${rawEmail}` : ip;
}

const baseOptions: Partial<Options> = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTest,
  message: { message: "Too many requests. Please slow down and try again later." }
};

/** Strict limiter for credential checks. */
export const loginLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: emailIpKey
});

/** Strict limiter for account creation. */
export const registerLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: emailIpKey
});

/** Looser limiter for confirmation-link clicks and token lookups. */
export const confirmationLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 30
});

/** Default catch-all for the rest of /api/auth/*. */
export const authBaselineLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 60
});
