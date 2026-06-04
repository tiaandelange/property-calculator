import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";

/** Annual billing charges 10 months of the listed monthly price (not 12). */
export const ANNUAL_BILLING_MONTH_COUNT = 10;

export type BillingPeriod = "monthly" | "annual";

export function annualPlanTotal(monthlyPrice: number): number {
  return monthlyPrice * ANNUAL_BILLING_MONTH_COUNT;
}

/** Effective monthly cost when paying the 10-month annual total across 12 months. */
export function annualEffectiveMonthly(monthlyPrice: number): number {
  return (monthlyPrice * ANNUAL_BILLING_MONTH_COUNT) / 12;
}

/**
 * Savings vs paying the listed monthly price for 12 months.
 * (12-month total − 10-month total) / 12-month total — same as 1 − 10/12.
 */
export function annualBillingSavingsPercent(monthlyPrice: number): number {
  if (monthlyPrice <= 0) return 0;
  const tenMonthTotal = annualPlanTotal(monthlyPrice);
  const twelveMonthTotal = monthlyPrice * 12;
  return Math.round((1 - tenMonthTotal / twelveMonthTotal) * 100);
}

export function isPaidPlan(plan: SubscriptionPlanRecord): boolean {
  return plan.monthlyPrice > 0;
}

function formatZarAmount(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPlanPrice(amount: number, currency = "ZAR"): string {
  if (amount === 0) return "Free";
  if (currency === "ZAR") {
    return `R${formatZarAmount(amount)}/month`;
  }
  return `${amount.toLocaleString()}/${currency}/month`;
}

export function formatAnnualPlanTotal(amount: number, currency = "ZAR"): string {
  if (currency === "ZAR") {
    return `R${formatZarAmount(amount)}/year`;
  }
  return `${amount.toLocaleString()}/${currency}/year`;
}

export function isFreePlan(plan: SubscriptionPlanRecord): boolean {
  return plan.monthlyPrice === 0;
}

export function planPriceHeadline(
  plan: SubscriptionPlanRecord,
  billing: BillingPeriod = "monthly"
): string {
  if (billing === "annual" && isPaidPlan(plan)) {
    return formatAnnualPlanTotal(annualPlanTotal(plan.monthlyPrice), plan.currency);
  }

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

export function planPriceSubline(
  plan: SubscriptionPlanRecord,
  billing: BillingPeriod = "monthly"
): string | null {
  if (billing === "annual" && isPaidPlan(plan)) {
    const effective = Math.round(annualEffectiveMonthly(plan.monthlyPrice));
    return `${formatPlanPrice(effective, plan.currency)} · pay for ${ANNUAL_BILLING_MONTH_COUNT} months`;
  }

  if (plan.code === "starter") {
    if (plan.trialDays > 0 && plan.monthlyPrice > 0) {
      return `Then ${formatPlanPrice(plan.monthlyPrice, plan.currency)}`;
    }
    if (isFreePlan(plan)) {
      return "Always free — upgrade anytime";
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
    return { label: "Join Free", href: `/signup?plan=${plan.code}`, variant: "primary" };
  }
  if (plan.code === "investor") {
    return { label: "Choose Investor", href: `/signup?plan=${plan.code}`, variant: "primary" };
  }
  if (plan.code === "portfolio") {
    return { label: "Choose Portfolio", href: `/signup?plan=${plan.code}`, variant: "primary" };
  }
  if (plan.code === "portfolio_pro") {
    return { label: "Contact Sales", href: "/contact", variant: "primary" };
  }
  return { label: "Choose plan", href: `/signup?plan=${plan.code}`, variant: "primary" };
}

export function planSecondaryCta(plan: SubscriptionPlanRecord): { label: string; href: string } | null {
  if (plan.code === "portfolio_pro") {
    return { label: "Request Quote", href: "/contact" };
  }
  return null;
}

export function isPopularPlan(plan: SubscriptionPlanRecord): boolean {
  return plan.code === "investor";
}

export function planDisplayName(code: string, plans: SubscriptionPlanRecord[]): string | null {
  return plans.find((p) => p.code === code)?.name ?? null;
}

/** True when the plan config includes a time-limited trial before billing. */
export function planHasTrialPeriod(plan: SubscriptionPlanRecord): boolean {
  return plan.trialDays > 0;
}

/** @deprecated Use planHasTrialPeriod — starter is permanently free, not a trial. */
export function starterShowsFreeTrial(plan: SubscriptionPlanRecord): boolean {
  return planHasTrialPeriod(plan);
}
