import type { VercelRequest } from "@vercel/node";
import Stripe from "stripe";
import { createServiceRoleSupabase } from "./supabaseServiceRole";

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

export async function createCheckoutSession(userId: string): Promise<{
  provider: string;
  sessionId?: string;
  checkoutUrl: string;
}> {
  const origin = frontendOrigin();
  const stripe = stripeClient();
  if (!stripe) {
    return { provider: "mock", checkoutUrl: `${origin}/subscription/success?mock=true` };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "zar",
          recurring: { interval: "month" },
          product_data: { name: "The Property Guy Monthly Subscription" },
          unit_amount: 9900
        },
        quantity: 1
      }
    ],
    success_url: `${origin}/subscription/success`,
    cancel_url: `${origin}/subscription/cancel`,
    metadata: { userId },
    subscription_data: { metadata: { userId } }
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return { provider: "stripe", sessionId: session.id, checkoutUrl: session.url };
}

export async function cancelSubscriptionForUser(userId: string): Promise<void> {
  const sb = createServiceRoleSupabase();
  if (!sb) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  const { error } = await sb
    .from("profiles")
    .update({
      subscription_status: "FREE",
      free_uses_remaining: 0,
      subscription_start: null,
      subscription_end: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  const sb = createServiceRoleSupabase();
  if (!sb) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return;
      const userId = parseUuidUserId(session.metadata?.userId);
      if (!userId) {
        console.warn("[stripe-webhook] checkout.session.completed missing userId UUID", { id: session.id });
        return;
      }
      const start = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      const { error: subErr } = await sb.from("subscriptions").insert({
        user_id: userId,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        status: "ACTIVE",
        payment_provider_id: typeof session.subscription === "string" ? session.subscription : null
      });
      if (subErr) throw new Error(subErr.message);
      const { error: profErr } = await sb
        .from("profiles")
        .update({
          subscription_status: "SUBSCRIBED",
          subscription_start: start.toISOString(),
          subscription_end: end.toISOString(),
          free_uses_remaining: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);
      if (profErr) throw new Error(profErr.message);
      return;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = parseUuidUserId(subscription.metadata?.userId);
      if (!userId) {
        console.warn("[stripe-webhook] customer.subscription.deleted missing userId UUID", {
          id: subscription.id
        });
        return;
      }
      const { error } = await sb
        .from("profiles")
        .update({
          subscription_status: "FREE",
          free_uses_remaining: 0,
          subscription_start: null,
          subscription_end: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return;
    }
    default:
      return;
  }
}

/** Read raw body for Stripe signature verification (webhook must disable body parser). */
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
