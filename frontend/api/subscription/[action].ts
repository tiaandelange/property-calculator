import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateSupabaseRequest } from "../lib/supabaseServerAuth.js";
import { BillingConfigError, getBillingProvider } from "../lib/billing/provider.js";
import { getUserSubscriptionPaymentId } from "../lib/billing/billingSubscriptionSync.js";
import { handleSubscriptionVerify } from "../lib/billing/handleSubscriptionVerify.js";
import { CheckoutValidationError } from "../lib/billing/checkoutValidation.js";
import { WebhookProcessingError } from "../lib/billing/billingSubscriptionSync.js";

type SubscriptionAction = "cancel" | "verify";

function parseAction(req: VercelRequest): SubscriptionAction | null {
  const raw = String(req.query.action ?? "").trim().toLowerCase();
  if (raw === "cancel" || raw === "verify") return raw;
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const action = parseAction(req);
  if (!action) {
    res.status(404).json({ error: "Unknown subscription action." });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    if (action === "verify") {
      const outcome = await handleSubscriptionVerify(req, auth.ctx.uid);
      res.status(200).json({ message: "Payment verified.", outcome });
      return;
    }

    const provider = getBillingProvider();
    const subscriptionId = await getUserSubscriptionPaymentId(auth.ctx.uid);
    await provider.cancelSubscription({
      userId: auth.ctx.uid,
      subscriptionId
    });
    res.status(200).json({ message: "Subscription cancelled.", provider: provider.name });
  } catch (e: unknown) {
    if (e instanceof BillingConfigError) {
      res.status(503).json({ error: e.message });
      return;
    }
    if (e instanceof CheckoutValidationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    if (e instanceof WebhookProcessingError) {
      res.status(422).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : `${action} failed.`;
    console.error(`[subscription/${action}]`, msg);
    res.status(500).json({ error: msg });
  }
}
