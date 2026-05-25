import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  handleStripeWebhookEvent,
  readRawBody,
  stripeClient
} from "../lib/stripeSubscriptionServer";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

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
  if (typeof signature !== "string" || !signature) {
    res.status(400).json({ error: "Missing Stripe-Signature header." });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    await handleStripeWebhookEvent(event);
    res.status(200).json({ received: true, type: event.type });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Webhook failed.";
    if (msg.includes("signature") || msg.includes("Signature")) {
      console.error("[subscription/webhook] signature error", msg);
      res.status(400).json({ error: "Invalid Stripe signature." });
      return;
    }
    console.error("[subscription/webhook]", msg);
    res.status(500).json({ error: msg });
  }
}
