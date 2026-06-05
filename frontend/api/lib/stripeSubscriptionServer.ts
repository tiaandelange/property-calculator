/**
 * Deprecated. Do not use for new billing.
 *
 * Legacy Stripe checkout (hardcoded R99) and webhook handlers that wrote
 * `profiles.subscription_status` and `public.subscriptions`. Retained until Paystack
 * checkout/webhooks are confirmed live; new billing uses `frontend/api/lib/billing/*`
 * and writes only `user_subscriptions`, `webhook_events`, and `checkout_attempts`.
 */
import type { VercelRequest } from "@vercel/node";
import Stripe from "stripe";

const STRIPE_BILLING_DEPRECATED =
  "Stripe billing is deprecated. Use POST /api/subscription/checkout with BILLING_PROVIDER=paystack or mock.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUuidUserId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return UUID_RE.test(s) ? s : null;
}

export function stripeClient(): Stripe | null {
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return null;
  return new Stripe(key);
}

/** Public site origin for Stripe redirect URLs (not the API host). */
export function frontendOrigin(): string {
  const explicit = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "").trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:5173";
}

/** @deprecated Use `getBillingProvider().createCheckoutSession` instead. */
export async function createCheckoutSession(_userId: string): Promise<never> {
  throw new Error(STRIPE_BILLING_DEPRECATED);
}

/** @deprecated Use `getBillingProvider().cancelSubscription` instead. */
export async function cancelSubscriptionForUser(userId: string): Promise<void> {
  console.warn("[stripe-deprecated] cancelSubscriptionForUser ignored", { userId });
}

/** @deprecated Legacy handler; no longer writes profiles or public.subscriptions. */
export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  console.warn("[stripe-deprecated] webhook event acknowledged without legacy writes", {
    type: event.type,
    id: event.id
  });
}

/** @deprecated Import from `frontend/api/lib/billing/readRawBody.ts` instead. */
export function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
