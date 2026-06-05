import type { VercelRequest } from "@vercel/node";
import { assertBillingCheckoutConfig, BillingConfigError } from "./billingEnv";
import { getBillingProvider } from "./provider";
import { recordCheckoutAttempt } from "./billingSubscriptionSync";
import {
  assertCheckoutAllowedForPlan,
  fetchSubscriptionPlanByCode,
  parseCheckoutRequest,
  requireCheckoutEmail
} from "./checkoutValidation";

export type SubscriptionCheckoutResult = {
  checkoutUrl: string;
  reference: string;
  provider: "mock" | "paystack" | "payfast";
};

export async function handleSubscriptionCheckout(
  req: VercelRequest,
  userId: string,
  email: string | null | undefined
): Promise<SubscriptionCheckoutResult> {
  const { planCode, billingPeriod } = parseCheckoutRequest(req);
  const plan = await fetchSubscriptionPlanByCode(planCode);
  assertCheckoutAllowedForPlan(plan);

  const checkoutEmail = requireCheckoutEmail(email);
  assertBillingCheckoutConfig();
  const provider = getBillingProvider();

  const session = await provider.createCheckoutSession({
    userId,
    email: checkoutEmail,
    planCode,
    billingPeriod
  });

  try {
    await recordCheckoutAttempt({
      userId,
      planCode,
      billingPeriod,
      provider: provider.name,
      providerReference: session.reference,
      checkoutUrl: session.checkoutUrl,
      status: "created"
    });
  } catch (recordErr) {
    console.warn("[subscription/checkout] checkout_attempts insert failed", recordErr);
  }

  return {
    checkoutUrl: session.checkoutUrl,
    reference: session.reference,
    provider: provider.name
  };
}

export function isBillingConfigError(error: unknown): error is BillingConfigError {
  return error instanceof BillingConfigError;
}
