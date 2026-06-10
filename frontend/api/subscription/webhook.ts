import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  handleProviderSubscriptionWebhook,
  mapWebhookError
} from "../_lib/billing/handleSubscriptionWebhook.js";
import { readRawBody } from "../_lib/billing/readRawBody.js";
import { hasLegacyStripeWebhookSignature } from "../_lib/billing/provider.js";
import { stripeClient } from "../_lib/stripeSubscriptionServer.js";

export const config = {
  api: {
    bodyParser: false
  }
};

/**
 * Deprecated. Do not use for new billing.
 * Stripe webhooks are verified and acknowledged but no longer update legacy tables.
 */
async function handleLegacyStripeWebhook(req: VercelRequest, res: VercelResponse): Promise<void> {
  const stripe = stripeClient();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured." });
    return;
  }
  if (!webhookSecret) {
    res.status(503).json({ error: "Stripe webhook secret is not configured." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || !signature.trim()) {
    res.status(400).json({ error: "Missing Stripe-Signature header." });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, signature.trim(), webhookSecret);
    console.warn("[subscription/webhook] deprecated Stripe webhook acknowledged without legacy writes", {
      type: event.type,
      id: event.id
    });
    res.status(200).json({
      received: true,
      provider: "stripe",
      type: event.type,
      legacy: true,
      deprecated: true
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Webhook failed.";
    if (msg.includes("signature") || msg.includes("Signature")) {
      console.error("[subscription/webhook] stripe signature error", msg);
      res.status(400).json({ error: "Invalid Stripe signature." });
      return;
    }
    console.error("[subscription/webhook] stripe", msg);
    res.status(500).json({ error: msg });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  if (hasLegacyStripeWebhookSignature(req)) {
    await handleLegacyStripeWebhook(req, res);
    return;
  }

  try {
    const result = await handleProviderSubscriptionWebhook(req);
    res.status(200).json(result);
  } catch (e: unknown) {
    const mapped = mapWebhookError(e);
    if (mapped.status === 400) {
      console.error("[subscription/webhook] verification error", mapped.message);
    } else {
      console.error("[subscription/webhook]", mapped.message);
    }
    res.status(mapped.status).json({ error: mapped.message });
  }
}
