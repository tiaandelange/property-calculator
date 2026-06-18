import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateSupabaseRequest } from "../supabaseServerAuth.js";
import { BillingConfigError, getBillingProvider, resolveBillingProviderName } from "../billing/provider.js";
import {
  WebhookProcessingError,
  activateSubscription,
  getUserSubscriptionPaymentId
} from "../billing/billingSubscriptionSync.js";
import { handleSubscriptionVerify } from "../billing/handleSubscriptionVerify.js";
import {
  CheckoutValidationError,
  fetchSubscriptionPlanByCode
} from "../billing/checkoutValidation.js";
import { handleSubscriptionCheckout } from "../billing/handleSubscriptionCheckout.js";
import { handleSubscriptionChangePlan } from "../billing/handleSubscriptionChangePlan.js";

type SubscriptionAction = "cancel" | "verify" | "checkout" | "mock-complete" | "change-plan";

function parseAction(req: VercelRequest): SubscriptionAction | null {
  const raw = String(req.query.action ?? "").trim().toLowerCase();
  if (raw === "cancel" || raw === "verify" || raw === "checkout" || raw === "mock-complete" || raw === "change-plan") {
    return raw;
  }
  return null;
}

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

async function handleMockComplete(req: VercelRequest, res: VercelResponse, uid: string): Promise<void> {
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
    userId: uid,
    planCode: plan.code,
    provider: "mock",
    customerId: uid,
    subscriptionId: reference,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString()
  });

  res.status(200).json({ status: "active", planCode: plan.code });
}

export async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const action = parseAction(req);
  if (!action) {
    res.status(404).json({ error: "Unknown subscription action." });
    return;
  }

  if (action === "mock-complete" && !isMockCompletionAllowed()) {
    res.status(403).json({ error: "Mock subscription completion is not available in this environment." });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    if (action === "checkout") {
      const payload = await handleSubscriptionCheckout(req, auth.ctx.uid, auth.ctx.user.email);
      res.status(200).json(payload);
      return;
    }

    if (action === "change-plan") {
      const outcome = await handleSubscriptionChangePlan(req, auth.ctx.uid);
      res.status(200).json(outcome);
      return;
    }

    if (action === "mock-complete") {
      await handleMockComplete(req, res, auth.ctx.uid);
      return;
    }

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
