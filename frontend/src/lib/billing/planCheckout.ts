import {
  startSubscriptionCheckout,
  type BillingPeriod,
  type PlanCheckoutCode
} from "../../services/subscriptionVercel";

export type { PlanCheckoutCode };

export async function redirectToPlanCheckout(
  planCode: PlanCheckoutCode,
  billingPeriod: BillingPeriod = "monthly"
): Promise<void> {
  const { checkoutUrl } = await startSubscriptionCheckout({ planCode, billingPeriod });
  window.location.assign(checkoutUrl);
}

export function isPaidCheckoutPlanCode(
  planCode: string,
  monthlyPrice: number
): planCode is PlanCheckoutCode {
  if (monthlyPrice <= 0 || planCode === "starter") return false;
  return planCode === "investor" || planCode === "portfolio" || planCode === "portfolio_pro";
}
