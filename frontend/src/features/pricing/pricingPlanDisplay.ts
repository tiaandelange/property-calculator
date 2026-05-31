import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";

export function formatPlanPrice(amount: number, currency = "ZAR"): string {
  if (currency === "ZAR") {
    return `R${amount.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}/month`;
  }
  return `${amount.toLocaleString()}/${currency}/month`;
}

export function planPriceHeadline(plan: SubscriptionPlanRecord): string {
  if (plan.code === "starter" && plan.trialDays > 0) {
    return `FREE trial for ${plan.trialDays} days, then ${formatPlanPrice(plan.monthlyPrice, plan.currency)}`;
  }
  if (plan.code === "portfolio_pro") {
    return `${formatPlanPrice(plan.monthlyPrice, plan.currency)} · or contact us`;
  }
  return formatPlanPrice(plan.monthlyPrice, plan.currency);
}

export function planPropertyLimitLabel(plan: SubscriptionPlanRecord): string {
  if (plan.propertyLimit == null) return "Unlimited properties";
  return `Up to ${plan.propertyLimit} ${plan.propertyLimit === 1 ? "property" : "properties"}`;
}

export function planReportLimitLabel(plan: SubscriptionPlanRecord): string {
  if (plan.includesUnlimitedReports || plan.reportLimit == null) return "Unlimited reports";
  return `${plan.reportLimit} investment reports`;
}

export function planFeatureBullets(plan: SubscriptionPlanRecord): string[] {
  const bullets: string[] = [planPropertyLimitLabel(plan), planReportLimitLabel(plan)];

  if (plan.includesCalculators && plan.includesManagement) {
    bullets.push("Calculators + management software");
  } else if (plan.includesManagement) {
    bullets.push("Portfolio management tools");
  } else if (plan.includesCalculators) {
    bullets.push("Property calculators");
  }

  if (plan.code === "portfolio") {
    bullets.push("Advanced portfolio management");
  }
  if (plan.code === "portfolio_pro") {
    bullets.push("Advanced reporting and future team features");
  }

  return bullets;
}

export function planCta(plan: SubscriptionPlanRecord): {
  label: string;
  href: string;
  variant: "primary" | "outline" | "soft";
  external?: boolean;
} {
  if (plan.code === "starter") {
    return { label: "Start free trial", href: `/signup?plan=${plan.code}`, variant: "primary" };
  }
  if (plan.code === "portfolio_pro") {
    return { label: "Contact us", href: "/contact", variant: "primary" };
  }
  return { label: "Subscribe", href: `/signup?plan=${plan.code}`, variant: "primary" };
}

export function planSecondaryCta(plan: SubscriptionPlanRecord): { label: string; href: string } | null {
  if (plan.code === "portfolio_pro") {
    return { label: "Subscribe online", href: `/signup?plan=${plan.code}` };
  }
  return null;
}

export function isPopularPlan(plan: SubscriptionPlanRecord): boolean {
  return plan.code === "investor";
}

export function planDisplayName(code: string, plans: SubscriptionPlanRecord[]): string | null {
  return plans.find((p) => p.code === code)?.name ?? null;
}
