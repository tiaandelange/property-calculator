import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import type { UserSubscriptionRecord } from "../../services/userSubscriptionsSupabase";
import { formatPlanPrice, planMarketingName } from "../pricing/pricingPlanDisplay";

/** Plans shown in the change-plan modal (excludes Portfolio Pro — contact sales). */
export const CHANGE_PLAN_MODAL_CODES = ["starter", "investor", "portfolio"] as const;

export function filterPlansForChangeModal(plans: SubscriptionPlanRecord[]): SubscriptionPlanRecord[] {
  const order = CHANGE_PLAN_MODAL_CODES as readonly string[];
  return [...plans]
    .filter((p) => order.includes(p.code))
    .sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
}

/**
 * Resolves which plan card is the user's current entitled plan.
 * pending_payment → Free (starter access) until payment confirms.
 */
export function resolveChangeModalCurrentPlanCode(
  subscription: UserSubscriptionRecord | null,
  entitlementsPlanCode: string | null
): string {
  if (!subscription) return "starter";

  const status = subscription.status;
  if (status === "pending_payment") {
    return "starter";
  }
  if (status === "active" || status === "trialing") {
    const code = subscription.planCode?.trim();
    if (code && CHANGE_PLAN_MODAL_CODES.includes(code as (typeof CHANGE_PLAN_MODAL_CODES)[number])) {
      return code;
    }
  }
  if (status === "cancelled" || status === "expired" || status === "past_due") {
    return "starter";
  }

  return entitlementsPlanCode ?? subscription.planCode ?? "starter";
}

export function resolvePendingCheckoutPlanCode(
  subscription: UserSubscriptionRecord | null
): string | null {
  if (subscription?.status !== "pending_payment") return null;
  const code = subscription.planCode?.trim();
  return code || null;
}

export function planModalPriceLine(plan: SubscriptionPlanRecord): string {
  if (plan.monthlyPrice <= 0) {
    return "R0/month";
  }
  return formatPlanPrice(plan.monthlyPrice, plan.currency);
}

export function planModalTrialNote(plan: SubscriptionPlanRecord): string | null {
  if (plan.trialDays > 0 && plan.monthlyPrice > 0) {
    return `${plan.trialDays}-day free trial available`;
  }
  return null;
}

export function planModalShortDescription(plan: SubscriptionPlanRecord): string {
  const byCode: Record<string, string> = {
    starter: "For your first properties — core tools at no cost.",
    investor: "For owner-managers growing a small portfolio.",
    portfolio: "For larger portfolios that need advanced reporting."
  };
  return byCode[plan.code] ?? plan.description ?? "";
}

export function planModalFeatureBullets(plan: SubscriptionPlanRecord): string[] {
  const lines: string[] = [];

  if (plan.maxProperties == null) {
    lines.push("Unlimited properties");
  } else {
    lines.push(`Up to ${plan.maxProperties} properties`);
  }

  if (plan.hasUnlimitedReports || plan.maxReportsPerMonth == null) {
    lines.push("Unlimited reports");
  } else if (plan.maxReportsPerMonth != null) {
    lines.push(`${plan.maxReportsPerMonth} reports per month`);
  }

  if (plan.code === "starter") {
    lines.push("Basic calculators");
    lines.push("Basic management tools");
  }

  if (plan.code === "investor") {
    lines.push("Management tools");
    lines.push("Invoices & statements");
    lines.push("Investment reports");
  }

  if (plan.code === "portfolio") {
    lines.push("Advanced portfolio analytics");
    lines.push("Recurring expenses");
    lines.push("PDF exports");
  }

  return lines.slice(0, 5);
}

export function planModalCtaLabel(
  plan: SubscriptionPlanRecord,
  opts: {
    isCurrent: boolean;
    isPendingCheckout: boolean;
    hasPaidPlan: boolean;
  }
): string {
  if (opts.isCurrent) return "Current plan";
  if (opts.isPendingCheckout) return "Complete payment";
  if (plan.code === "starter") {
    return opts.hasPaidPlan ? "Downgrade to Free" : "Current plan";
  }
  return `Choose ${planMarketingName(plan)}`;
}
