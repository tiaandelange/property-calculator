import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import { isPaidPlan } from "../pricing/pricingPlanDisplay";

/** After signup, redirect user to subscription settings (and optionally auto-checkout). */
export const PENDING_SIGNUP_BILLING_REDIRECT_KEY = "pg_pending_signup_billing_redirect";

export type SignupBillingRedirect = {
  planCode: string;
  autoCheckout: boolean;
};

export function planRequiresPaymentAfterSignup(plan: SubscriptionPlanRecord): boolean {
  return isPaidPlan(plan) && plan.trialDays === 0;
}

export function buildSignupBillingRedirect(plan: SubscriptionPlanRecord): SignupBillingRedirect | null {
  if (!isPaidPlan(plan)) return null;
  return {
    planCode: plan.code,
    autoCheckout: planRequiresPaymentAfterSignup(plan)
  };
}

export function storeSignupBillingRedirect(redirect: SignupBillingRedirect): void {
  sessionStorage.setItem(PENDING_SIGNUP_BILLING_REDIRECT_KEY, JSON.stringify(redirect));
}

export function consumeSignupBillingRedirect(): SignupBillingRedirect | null {
  const raw = sessionStorage.getItem(PENDING_SIGNUP_BILLING_REDIRECT_KEY);
  sessionStorage.removeItem(PENDING_SIGNUP_BILLING_REDIRECT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SignupBillingRedirect;
    if (!parsed?.planCode) return null;
    return {
      planCode: String(parsed.planCode),
      autoCheckout: Boolean(parsed.autoCheckout)
    };
  } catch {
    return null;
  }
}

export function settingsSubscriptionPath(opts?: {
  checkout?: boolean;
  planCode?: string;
}): string {
  const params = new URLSearchParams({ section: "subscription" });
  if (opts?.checkout) params.set("checkout", "1");
  if (opts?.planCode) params.set("plan", opts.planCode);
  return `/settings?${params.toString()}`;
}
