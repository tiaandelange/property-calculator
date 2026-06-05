import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateSupabaseRequest } from "../lib/supabaseServerAuth.js";
import { activateSubscription } from "../lib/billing/billingSubscriptionSync.js";
import { CheckoutValidationError, fetchSubscriptionPlanByCode } from "../lib/billing/checkoutValidation.js";
import { resolveBillingProviderName } from "../lib/billing/provider.js";

function isMockCompletionAllowed(): boolean {
  try {
    if (resolveBillingProviderName() !== "mock") return false;
  } catch {
    return false;
  }
  if (process.env.NODE_ENV !== "production") return true;
  const vercelEnv = (process.env.VERCEL_ENV || "").trim();
  return vercelEnv === "development" || vercelEnv === "preview";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  if (!isMockCompletionAllowed()) {
    res.status(403).json({ error: "Mock subscription completion is not available in this environment." });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const planCode = String(body.planCode ?? "").trim().toLowerCase();
    if (!planCode || planCode === "starter") {
      res.status(400).json({ error: "A paid planCode is required for mock completion." });
      return;
    }

    const plan = await fetchSubscriptionPlanByCode(planCode);
    if (plan.monthlyPrice <= 0) {
      res.status(400).json({ error: "Starter is free and does not require checkout." });
      return;
    }

    const reference = String(body.reference ?? `mock_complete_${Date.now()}`).trim();
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await activateSubscription({
      userId: auth.ctx.uid,
      planCode: plan.code,
      provider: "mock",
      customerId: auth.ctx.uid,
      subscriptionId: reference,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString()
    });

    res.status(200).json({ status: "active", planCode: plan.code });
  } catch (e: unknown) {
    if (e instanceof CheckoutValidationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : "Mock completion failed.";
    console.error("[subscription/mock-complete]", msg);
    res.status(500).json({ error: msg });
  }
}
