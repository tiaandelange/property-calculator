import type { SubscriptionPlanRecord } from "../../services/subscriptionPlansSupabase";
import type { SubscriptionUsageCounts } from "../../services/subscriptionUsageSupabase";
import type { UserSubscriptionRecord } from "../../services/userSubscriptionsSupabase";

export const PLAN_LIMIT_UPGRADE_MESSAGE =
  "You have reached the limit for your current plan. Upgrade to continue.";

export type ComputedSubscriptionLimits = {
  currentPlan: SubscriptionPlanRecord | null;
  planName: string | null;
  propertyLimit: number | null;
  reportLimit: number | null;
  currentPropertyCount: number;
  currentReportCount: number;
  canCreateProperty: boolean;
  canGenerateReport: boolean;
  upgradeMessage: string | null;
  /** User has no `user_subscriptions` row — property limits are not enforced. */
  isLegacyProfile: boolean;
  /** Plan limits apply (subscription row or legacy free-report cap). */
  limitsActive: boolean;
  reportPeriodLabel: string;
};

export function computeSubscriptionLimits(input: {
  plans: SubscriptionPlanRecord[];
  subscription: UserSubscriptionRecord | null;
  usage: SubscriptionUsageCounts | null;
  freeUsesRemaining?: number | null;
  role?: string | null;
}): ComputedSubscriptionLimits {
  const usage = input.usage ?? {
    propertyCount: 0,
    investmentReportCount: 0,
    period: { start: new Date(), end: new Date(), label: "This period" }
  };

  if (input.role === "ADMIN") {
    return {
      currentPlan: null,
      planName: "Admin",
      propertyLimit: null,
      reportLimit: null,
      currentPropertyCount: usage.propertyCount,
      currentReportCount: usage.investmentReportCount,
      canCreateProperty: true,
      canGenerateReport: true,
      upgradeMessage: null,
      isLegacyProfile: false,
      limitsActive: false,
      reportPeriodLabel: usage.period.label
    };
  }

  if (!input.subscription) {
    const legacyReportCap =
      input.freeUsesRemaining != null && Number.isFinite(input.freeUsesRemaining)
        ? Math.max(0, input.freeUsesRemaining)
        : null;
    const canGenerateReport = legacyReportCap == null || legacyReportCap > 0;

    return {
      currentPlan: null,
      planName: null,
      propertyLimit: null,
      reportLimit: legacyReportCap,
      currentPropertyCount: usage.propertyCount,
      currentReportCount: usage.investmentReportCount,
      canCreateProperty: true,
      canGenerateReport,
      upgradeMessage: canGenerateReport ? null : PLAN_LIMIT_UPGRADE_MESSAGE,
      isLegacyProfile: true,
      limitsActive: legacyReportCap != null,
      reportPeriodLabel:
        legacyReportCap != null ? "Free calculator reports remaining" : usage.period.label
    };
  }

  const plan = input.plans.find((p) => p.code === input.subscription!.planCode) ?? null;
  const propertyLimit = plan?.propertyLimit ?? null;
  const reportLimit =
    plan?.includesUnlimitedReports || plan?.reportLimit == null ? null : plan.reportLimit;

  const canCreateProperty = propertyLimit == null || usage.propertyCount < propertyLimit;
  const canGenerateReport =
    reportLimit == null || usage.investmentReportCount < reportLimit;

  const atPropertyLimit = !canCreateProperty;
  const atReportLimit = !canGenerateReport;

  return {
    currentPlan: plan,
    planName: plan?.name ?? input.subscription.planCode,
    propertyLimit,
    reportLimit,
    currentPropertyCount: usage.propertyCount,
    currentReportCount: usage.investmentReportCount,
    canCreateProperty,
    canGenerateReport,
    upgradeMessage:
      atPropertyLimit || atReportLimit ? PLAN_LIMIT_UPGRADE_MESSAGE : null,
    isLegacyProfile: false,
    limitsActive: true,
    reportPeriodLabel: usage.period.label
  };
}

export function formatPropertyLimitUsage(
  current: number,
  limit: number | null
): string {
  if (limit == null) return `${current} properties · unlimited plan`;
  return `${current} / ${limit} properties`;
}

export function formatReportLimitUsage(
  current: number,
  limit: number | null,
  periodLabel: string
): string {
  if (limit == null) return `${current} reports (${periodLabel}) · unlimited`;
  return `${current} / ${limit} reports (${periodLabel})`;
}
