import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";

export type SubscriptionFeatureRow = {
  key: string;
  label: string;
  enabled: boolean;
};

/** Feature flags shown on Settings → Subscription (plan-linked). */
export function subscriptionDashboardFeatureRows(
  plan: SubscriptionPlanRecord | null,
  opts?: { isAdmin?: boolean }
): SubscriptionFeatureRow[] {
  if (opts?.isAdmin) {
    return [
      { key: "fullAnalytics", label: "Full analytics", enabled: true },
      { key: "irr", label: "IRR", enabled: true },
      { key: "graphs", label: "Graphs", enabled: true },
      { key: "forecasting", label: "Forecasting", enabled: true },
      { key: "portfolioDashboard", label: "Portfolio dashboard", enabled: true },
      { key: "propertyComparison", label: "Property comparison", enabled: true },
      { key: "advancedReports", label: "Advanced reports", enabled: true },
      { key: "unlimitedReports", label: "Unlimited reports", enabled: true },
      { key: "reportBranding", label: "Report branding", enabled: true },
      { key: "teamAccess", label: "Team access", enabled: true },
      { key: "prioritySupport", label: "Priority support", enabled: true }
    ];
  }

  if (!plan) {
    return [];
  }

  return [
    { key: "fullAnalytics", label: "Full analytics", enabled: plan.hasFullAnalytics },
    { key: "irr", label: "IRR", enabled: plan.hasIrr },
    { key: "graphs", label: "Graphs", enabled: plan.hasGraphs },
    { key: "forecasting", label: "Forecasting", enabled: plan.hasForecasting },
    {
      key: "portfolioDashboard",
      label: "Portfolio dashboard",
      enabled: plan.hasPortfolioDashboard
    },
    {
      key: "propertyComparison",
      label: "Property comparison",
      enabled: plan.hasPropertyComparison
    },
    { key: "advancedReports", label: "Advanced reports", enabled: plan.hasAdvancedReports },
    {
      key: "unlimitedReports",
      label: "Unlimited reports",
      enabled: plan.hasUnlimitedReports
    },
    { key: "reportBranding", label: "Report branding", enabled: plan.hasReportBranding },
    { key: "teamAccess", label: "Team access", enabled: plan.hasTeamAccess },
    { key: "prioritySupport", label: "Priority support", enabled: plan.hasPrioritySupport }
  ];
}

export function planApplicationLinksLimitLabel(plan: SubscriptionPlanRecord | null): string {
  if (!plan) return "—";
  if (plan.hasApplicationLinks && plan.maxApplicationLinks == null) {
    return "Unlimited active links";
  }
  if (plan.maxApplicationLinks != null) {
    return `Up to ${plan.maxApplicationLinks} active ${
      plan.maxApplicationLinks === 1 ? "link" : "links"
    }`;
  }
  if (!plan.hasApplicationLinks) {
    return "Not included on this plan";
  }
  return "—";
}
