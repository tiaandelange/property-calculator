import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { db } from "../config/db.js";
import { authRequired, AuthRequest } from "../middleware/auth.js";
import { env, isProduction } from "../config/env.js";

export const subscriptionRoutes = Router();

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

subscriptionRoutes.post("/checkout", authRequired, async (req: AuthRequest, res) => {
  if (!stripe) {
    return res.json({ provider: "mock", checkoutUrl: `${env.FRONTEND_URL}/subscription/success?mock=true` });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "zar",
        recurring: { interval: "month" },
        product_data: { name: "The Property Guy Monthly Subscription" },
        unit_amount: 9900
      },
      quantity: 1
    }],
    success_url: `${env.FRONTEND_URL}/subscription/success`,
    cancel_url: `${env.FRONTEND_URL}/subscription/cancel`,
    // The webhook reads this metadata back to identify the user. We stamp it on both
    // the Checkout Session and the resulting Subscription so customer.subscription.*
    // events can be matched without a separate customer lookup.
    metadata: { userId: String(req.userId) },
    subscription_data: {
      metadata: { userId: String(req.userId) }
    }
  });
  res.json({ provider: "stripe", sessionId: session.id, checkoutUrl: session.url });
});

subscriptionRoutes.post("/cancel", authRequired, async (req: AuthRequest, res) => {
  await db.user.update({ where: { id: req.userId! }, data: { subscription_status: "FREE", free_uses_remaining: 0 } });
  res.json({ message: "Subscription cancelled." });
});

/**
 * Stripe webhook handler.
 *
 * SECURITY: The request signature is verified against the **raw** request body using
 * STRIPE_WEBHOOK_SECRET. Unsigned/forged requests are rejected with 400. This handler
 * MUST be mounted with `express.raw({ type: "application/json" })` and BEFORE the
 * global `express.json()` middleware — otherwise the JSON parser will mutate the
 * body and signature verification will fail every time.
 *
 * The legacy unauthenticated `{ userId }` payload path has been removed: it allowed
 * any internet caller to grant arbitrary users a paid subscription.
 */
export async function stripeWebhookHandler(req: Request, res: Response) {
  if (!stripe) {
    console.error("[stripe-webhook] STRIPE_SECRET_KEY is not configured");
    return res.status(503).json({ message: "Stripe is not configured." });
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return res.status(503).json({ message: "Stripe webhook secret is not configured." });
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || signature.length === 0) {
    return res.status(400).json({ message: "Missing Stripe-Signature header." });
  }

  // Defence-in-depth: the global JSON parser must NOT have run before this handler,
  // so req.body must be a Buffer of the exact bytes Stripe signed.
  if (!Buffer.isBuffer(req.body)) {
    console.error("[stripe-webhook] req.body is not a Buffer — raw body parser is not mounted before express.json()");
    return res.status(500).json({ message: "Webhook is misconfigured." });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[stripe-webhook] signature verification failed", err?.message ?? err);
    return res.status(400).json({ message: "Invalid Stripe signature." });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const userId = Number(session.metadata?.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
          console.warn("[stripe-webhook] checkout.session.completed without valid userId metadata", { id: session.id });
          break;
        }
        const start = new Date();
        const end = new Date();
        end.setMonth(end.getMonth() + 1);
        await db.subscription.create({
          data: {
            user_id: userId,
            start_date: start,
            end_date: end,
            status: "ACTIVE",
            payment_provider_id: typeof session.subscription === "string" ? session.subscription : null
          }
        });
        await db.user.update({
          where: { id: userId },
          data: {
            subscription_status: "SUBSCRIBED",
            subscription_start: start,
            subscription_end: end,
            free_uses_remaining: null
          }
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = Number(subscription.metadata?.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
          console.warn("[stripe-webhook] customer.subscription.deleted without valid userId metadata", { id: subscription.id });
          break;
        }
        await db.user.update({
          where: { id: userId },
          data: { subscription_status: "FREE", free_uses_remaining: 0 }
        });
        break;
      }
      default:
        // Unhandled event types are still ACKed so Stripe does not retry forever.
        break;
    }
    return res.json({ received: true, type: event.type });
  } catch (err: any) {
    console.error(`[stripe-webhook] failed handling ${event.type}`, err?.stack ?? err);
    if (isProduction) return res.status(500).json({ message: "Webhook handler failed." });
    return res.status(500).json({ message: err?.message ?? "Webhook handler failed." });
  }
}
