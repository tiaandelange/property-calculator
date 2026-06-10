import {
  startSubscriptionCheckout,
  type BillingPeriod,
  type PlanCheckoutCode
} from "../../services/subscriptionVercel";
import { trackEvent } from "../analytics/analytics";

export type { PlanCheckoutCode };

export async function redirectToPlanCheckout(
  planCode: PlanCheckoutCode,
  billingPeriod: BillingPeriod = "monthly"
): Promise<void> {
  const { checkoutUrl } = await startSubscriptionCheckout({ planCode, billingPeriod });
  trackEvent("checkout_start", {
    plan_code: planCode,
    billing_period: billingPeriod,
    source_page: `${window.location.pathname}${window.location.search}`
  });
  window.location.assign(checkoutUrl);
}

export function isPaidCheckoutPlanCode(
  planCode: string,
  monthlyPrice: number
): planCode is PlanCheckoutCode {
  if (monthlyPrice <= 0 || planCode === "starter") return false;
  return planCode === "investor" || planCode === "portfolio" || planCode === "portfolio_pro";
}
