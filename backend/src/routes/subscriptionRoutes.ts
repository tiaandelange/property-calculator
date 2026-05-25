import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { getSupabaseAdminClient } from "../config/supabaseClient.js";
import { authRequired, type AuthRequest } from "../middleware/auth.js";
import { env } from "../config/env.js";

export const subscriptionRoutes = Router();

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuidUserId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return UUID_RE.test(s) ? s : null;
}

subscriptionRoutes.post("/checkout", authRequired, async (req: AuthRequest, res) => {
  if (!stripe) {
    return res.json({ provider: "mock", checkoutUrl: `${env.FRONTEND_URL}/subscription/success?mock=true` });
  }
  const uid = req.userId!;
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
    success_url: `${env.FRONTEND_URL}/subscription/success`,
    cancel_url: `${env.FRONTEND_URL}/subscription/cancel`,
    metadata: { userId: uid },
    subscription_data: {
      metadata: { userId: uid }
    }
  });
  res.json({ provider: "stripe", sessionId: session.id, checkoutUrl: session.url });
});

subscriptionRoutes.post("/cancel", authRequired, async (req: AuthRequest, res) => {
  const sb = getSupabaseAdminClient();
  const { error } = await sb
    .from("profiles")
    .update({
      subscription_status: "FREE",
      free_uses_remaining: 0,
      subscription_start: null,
      subscription_end: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", req.userId!);
  if (error) {
    return res.status(500).json({ message: error.message });
  }
  res.json({ message: "Subscription cancelled." });
});

/**
 * Stripe webhook — updates `public.profiles` and `public.subscriptions` via service role.
 * Metadata `userId` must be a Supabase profile UUID (auth.users id).
 */
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  if (!stripe) {
    console.error("[stripe-webhook] STRIPE_SECRET_KEY is not configured");
    res.status(503).json({ message: "Stripe is not configured." });
    return;
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured");
    res.status(503).json({ message: "Stripe webhook secret is not configured." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || signature.length === 0) {
    res.status(400).json({ message: "Missing Stripe-Signature header." });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    console.error("[stripe-webhook] req.body is not a Buffer — raw body parser must run before express.json()");
    res.status(500).json({ message: "Webhook is misconfigured." });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] signature verification failed", msg);
    res.status(400).json({ message: "Invalid Stripe signature." });
    return;
  }

  const sb = getSupabaseAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const userId = parseUuidUserId(session.metadata?.userId);
        if (!userId) {
          console.warn("[stripe-webhook] checkout.session.completed without valid userId UUID", {
            id: session.id
          });
          break;
        }
        const start = new Date();
        const end = new Date();
        end.setMonth(end.getMonth() + 1);
        await sb.from("subscriptions").insert({
          user_id: userId,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          status: "ACTIVE",
          payment_provider_id:
            typeof session.subscription === "string" ? session.subscription : null
        });
        await sb
          .from("profiles")
          .update({
            subscription_status: "SUBSCRIBED",
            subscription_start: start.toISOString(),
            subscription_end: end.toISOString(),
            free_uses_remaining: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", userId);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = parseUuidUserId(subscription.metadata?.userId);
        if (!userId) {
          console.warn("[stripe-webhook] customer.subscription.deleted without valid userId UUID", {
            id: subscription.id
          });
          break;
        }
        await sb
          .from("profiles")
          .update({
            subscription_status: "FREE",
            free_uses_remaining: 0,
            subscription_start: null,
            subscription_end: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", userId);
        break;
      }
      default:
        break;
    }
    res.json({ received: true, type: event.type });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook handler failed.";
    console.error(`[stripe-webhook] failed handling ${event.type}`, err);
    res.status(500).json({ message: msg });
  }
}
