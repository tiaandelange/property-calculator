import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateSupabaseRequest } from "../lib/supabaseServerAuth.js";
import { CheckoutValidationError } from "../lib/billing/checkoutValidation.js";
import {
  handleSubscriptionCheckout,
  isBillingConfigError
} from "../lib/billing/handleSubscriptionCheckout.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const payload = await handleSubscriptionCheckout(req, auth.ctx.uid, auth.ctx.user.email);
    res.status(200).json(payload);
  } catch (e: unknown) {
    if (e instanceof CheckoutValidationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    if (isBillingConfigError(e)) {
      res.status(503).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : "Checkout failed.";
    console.error("[subscription/checkout]", msg);
    res.status(500).json({ error: msg });
  }
}
