import { STARTER_POST_TRIAL_PRICE_LABEL } from "../../data/pricingPageContent";
import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";

export function formatPlanPrice(amount: number, currency = "ZAR"): string {
  if (amount === 0) return "Free";
  if (currency === "ZAR") {
    return `R${amount.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}/month`;
  }
  return `${amount.toLocaleString()}/${currency}/month`;
}

export function isFreePlan(plan: SubscriptionPlanRecord): boolean {
  return plan.monthlyPrice === 0;
}

export function planPriceHeadline(plan: SubscriptionPlanRecord): string {
  if (plan.code === "starter") {
    if (plan.trialDays > 0 && plan.monthlyPrice > 0) {
      return "FREE";
    }
    if (isFreePlan(plan)) {
      return "FREE";
    }
  }
  if (isFreePlan(plan)) {
    return "Free";
  }
  if (plan.trialDays > 0 && plan.monthlyPrice > 0) {
    return `FREE · ${plan.trialDays}-day trial`;
  }
  return formatPlanPrice(plan.monthlyPrice, plan.currency);
}

export function planPriceSubline(plan: SubscriptionPlanRecord): string | null {
  if (plan.code === "starter") {
    if (plan.trialDays > 0 && plan.monthlyPrice > 0) {
      return `Then ${formatPlanPrice(plan.monthlyPrice, plan.currency)}`;
    }
    if (isFreePlan(plan)) {
      return `14-day free trial, then ${STARTER_POST_TRIAL_PRICE_LABEL}`;
    }
  }
  if (plan.trialDays > 0 && plan.monthlyPrice > 0) {
    return `Then ${formatPlanPrice(plan.monthlyPrice, plan.currency)}`;
  }
  if (plan.code === "portfolio_pro") {
    return "Or contact us for larger portfolios";
  }
  return null;
}

export function planBestFor(plan: SubscriptionPlanRecord): string {
  const byCode: Record<string, string> = {
    starter: "Testing Proplytic with your first properties.",
    investor: "Owner-managers and small portfolio investors.",
    portfolio: "Growing portfolios that need stronger reporting.",
    portfolio_pro: "Larger owner-managed portfolios."
  };
  return byCode[plan.code] ?? plan.description ?? "";
}

export function planPropertyLimitLabel(plan: SubscriptionPlanRecord): string {
  if (plan.propertyLimit == null) return "Unlimited properties";
  return `Up to ${plan.propertyLimit} ${plan.propertyLimit === 1 ? "property" : "properties"}`;
}

export function planReportLimitLabel(plan: SubscriptionPlanRecord): string {
  if (plan.includesUnlimitedReports || plan.reportLimit == null) return "Unlimited reports";
  return `${plan.reportLimit} investment reports per month`;
}

export function planCardFeatureLines(plan: SubscriptionPlanRecord): string[] {
  const lines: string[] = [planPropertyLimitLabel(plan)];

  if (plan.code === "starter") {
    lines.push("Basic calculators");
    lines.push("Basic management tools");
    lines.push("Limited report analytics");
    return lines;
  }

  if (plan.includesCalculators) {
    lines.push("Calculator tools included");
  }
  if (plan.includesManagement) {
    lines.push("Management software included");
  }

  if (!plan.includesUnlimitedReports && plan.reportLimit != null) {
    lines.push(`${plan.reportLimit} investment reports`);
  } else if (plan.includesUnlimitedReports) {
    lines.push("Unlimited investment reports");
  }

  if (plan.code === "investor") {
    lines.push("Invoices and statements");
    lines.push("Property analytics dashboard");
  }

  if (plan.code === "portfolio") {
    lines.push("Advanced portfolio analytics");
    lines.push("Invoices, statements and lease tools");
    lines.push("Recurring expenses");
    lines.push("PDF exports");
  }

  if (plan.code === "portfolio_pro") {
    lines.push("Advanced reporting");
    lines.push("Priority support");
    lines.push("Future team access (planned)");
  }

  return lines;
}

/** @deprecated Use planCardFeatureLines for pricing cards. */
export function planFeatureBullets(plan: SubscriptionPlanRecord): string[] {
  return planCardFeatureLines(plan);
}

export function planCta(plan: SubscriptionPlanRecord): {
  label: string;
  href: string;
  variant: "primary" | "outline" | "soft";
  external?: boolean;
} {
  if (plan.code === "starter") {
    return { label: "Sign Up", href: `/signup?plan=${plan.code}`, variant: "primary" };
  }
  if (plan.code === "portfolio_pro") {
    return { label: "Subscribe", href: `/signup?plan=${plan.code}`, variant: "primary" };
  }
  return { label: "Subscribe", href: `/signup?plan=${plan.code}`, variant: "primary" };
}

export function planSecondaryCta(plan: SubscriptionPlanRecord): { label: string; href: string } | null {
  if (plan.code === "portfolio_pro") {
    return { label: "Contact us", href: "/contact" };
  }
  return null;
}

export function isPopularPlan(plan: SubscriptionPlanRecord): boolean {
  return plan.code === "investor";
}

export function planDisplayName(code: string, plans: SubscriptionPlanRecord[]): string | null {
  return plans.find((p) => p.code === code)?.name ?? null;
}

export function starterShowsFreeTrial(plan: SubscriptionPlanRecord): boolean {
  return plan.code === "starter" && (plan.trialDays > 0 || isFreePlan(plan));
}
