import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRoutes } from "./routes/authRoutes.js";
import { calculatorRoutes } from "./routes/calculatorRoutes.js";
import { subscriptionRoutes, stripeWebhookHandler } from "./routes/subscriptionRoutes.js";
import { reportRoutes } from "./routes/reportRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { ownedPropertiesRoutes } from "./routes/ownedPropertiesRoutes.js";
import { env } from "./config/env.js";
import {
  loginLimiter,
  registerLimiter,
  confirmationLimiter,
  authBaselineLimiter
} from "./middleware/rateLimiters.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();

/**
 * In production we sit behind one or more L7 proxies (Cloudflare → Render/
 * Railway). `trust proxy` controls how many of those hops Express should peel
 * off when computing `req.ip` and `req.protocol`. Without this:
 *   - the rate limiters all see the same upstream proxy IP and effectively
 *     do nothing (or worse: an attacker shares the proxy IP with a legitimate
 *     user and locks them out);
 *   - Helmet's HSTS / `Secure` cookie logic thinks the request is over HTTP.
 *
 * The value comes from `env.TRUST_PROXY` which defaults to 1 in production
 * and false elsewhere. NEVER set this to `true` blindly — it lets any client
 * spoof `X-Forwarded-For`.
 */
app.set("trust proxy", env.TRUST_PROXY);

/**
 * Security-relevant response headers. Helmet's defaults are safe for a JSON API:
 *   - X-Content-Type-Options: nosniff
 *   - X-Frame-Options: SAMEORIGIN
 *   - Strict-Transport-Security (when served over HTTPS by the proxy)
 *   - Referrer-Policy: no-referrer
 *   - Cross-Origin-Resource-Policy: same-origin
 *
 * We disable the auto-CSP because this server returns JSON, not HTML, and a CSP
 * is enforced at the static frontend (nginx or Vercel — see frontend/nginx.conf
 * and frontend/vercel.json).
 */
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

/**
 * CORS allow-list. We accept any origin that appears in `ALLOWED_ORIGINS`
 * (sourced from FRONTEND_URLS or FRONTEND_URL in env). Requests with no
 * Origin header (e.g. curl, server-to-server calls, the Stripe webhook) are
 * always allowed because CORS is a browser-only protection.
 *
 * We do NOT enable `credentials: true` because the frontend talks to the
 * backend with a bearer token in the Authorization header, not cookies.
 */
const allowedOrigins = new Set(env.ALLOWED_ORIGINS);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: false
  })
);

// Stripe webhook MUST receive the raw request body bytes so that the signature can
// be verified against STRIPE_WEBHOOK_SECRET. It is therefore mounted with the raw
// body parser BEFORE the global express.json() middleware. Re-ordering or removing
// this block will silently break webhook signature verification.
//
// The 1 MiB cap matches Stripe's documented event-payload ceiling and stops a
// malicious caller from buffering huge bodies while waiting for the verifier.
app.post(
  "/api/subscription/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  stripeWebhookHandler
);

// Body size limit: anything bigger than 200 KB on JSON endpoints is rejected at
// the parser level (errors are mapped to a clean 413 by errorHandler). This caps
// the worst-case memory burn from a single anonymous POST and stops obvious
// JSON-body DoS attempts. File uploads go through multer with their own limit.
app.use(express.json({ limit: "200kb" }));

app.use((req, _res, next) => {
  const startedAt = Date.now();
  console.log(`[req] ${req.method} ${req.path}`);
  _res.on("finish", () => {
    const ms = Date.now() - startedAt;
    console.log(`[res] ${req.method} ${req.path} -> ${_res.statusCode} (${ms}ms)`);
  });
  next();
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Auth surface is rate-limited per route (limiters defined in
// middleware/rateLimiters). The router itself stays simple; the limiters mount
// in front of the specific sub-paths.
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth/confirm-email", confirmationLimiter);
app.use("/api/auth", authBaselineLimiter, authRoutes);

app.use("/api/calculations", calculatorRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", ownedPropertiesRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
