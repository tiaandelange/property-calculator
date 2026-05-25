import express from "express";
import cors from "cors";
import helmet from "helmet";
import { subscriptionRoutes, stripeWebhookHandler } from "./routes/subscriptionRoutes.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

/**
 * Slim production API — Supabase is the system of record.
 * Domain CRUD, PDFs, statements, and admin run on Vercel Functions + Supabase RPC/RLS.
 * This process serves health checks, Stripe checkout/webhook, and CORS for the SPA.
 */
export const app = express();

app.set("trust proxy", env.TRUST_PROXY);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

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

app.post(
  "/api/subscription/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  stripeWebhookHandler
);

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

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    dataStore: "supabase",
    note: "Portfolio CRUD is served by Supabase + Vercel; this API is health + Stripe only."
  });
});

app.use("/api/subscription", subscriptionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
