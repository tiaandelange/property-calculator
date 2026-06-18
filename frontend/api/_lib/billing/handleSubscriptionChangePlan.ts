import type { VercelRequest } from "@vercel/node";
import { getBillingProvider } from "./provider.js";
import {
  CheckoutValidationError,
  fetchSubscriptionPlanByCode
} from "./checkoutValidation.js";
import {
  downgradeToStarterPlan,
  getUserSubscriptionPaymentId
} from "./billingSubscriptionSync.js";

export type ChangePlanResult =
  | { action: "downgraded"; planCode: "starter" }
  | { action: "checkout_required"; planCode: string; billingPeriod: "monthly" | "annual" };

function parseChangePlanRequest(req: VercelRequest): { planCode: string; billingPeriod: "monthly" | "annual" } {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};

  const planCode = String(body.planCode ?? "").trim().toLowerCase();
  if (!planCode) {
    throw new CheckoutValidationError("planCode is required.");
  }

  const billingPeriodRaw = String(body.billingPeriod ?? "monthly").trim().toLowerCase();
  const billingPeriod = billingPeriodRaw === "annual" ? "annual" : "monthly";

  return { planCode, billingPeriod };
}

export async function handleSubscriptionChangePlan(
  req: VercelRequest,
  userId: string
): Promise<ChangePlanResult> {
  const { planCode, billingPeriod } = parseChangePlanRequest(req);
  const plan = await fetchSubscriptionPlanByCode(planCode);

  if (plan.code === "starter" || plan.monthlyPrice <= 0) {
    const subscriptionId = await getUserSubscriptionPaymentId(userId);
    if (subscriptionId) {
      const provider = getBillingProvider();
      await provider.cancelSubscription({ userId, subscriptionId });
    }
    await downgradeToStarterPlan(userId);
    return { action: "downgraded", planCode: "starter" };
  }

  if (!plan.isActive) {
    throw new CheckoutValidationError(`Plan "${plan.name}" is not available.`, 404);
  }

  return { action: "checkout_required", planCode: plan.code, billingPeriod };
}
