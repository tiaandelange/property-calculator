import { PLAN_LIMIT_UPGRADE_MESSAGE } from "../../lib/subscription/planFeatures";
import { usePlanPermissions, type PlanPermissions } from "../../lib/subscription/usePlanPermissions";
import type { ComputedSubscriptionLimits } from "./subscriptionLimits";

/** @deprecated Prefer usePlanPermissions from lib/subscription */
export type SubscriptionLimits = ComputedSubscriptionLimits & {
  isLoading: boolean;
  isError: boolean;
};

/** @deprecated Prefer usePlanPermissions — thin adapter for legacy imports */
export function useSubscriptionLimits(): SubscriptionLimits {
  const permissions = usePlanPermissions();
  return {
    currentPlan: permissions.currentPlan,
    planName: permissions.planName,
    propertyLimit: permissions.limits.maxProperties,
    reportLimit: permissions.limits.maxReportsPerMonth,
    currentPropertyCount: permissions.usage.propertyCount,
    currentReportCount: permissions.usage.investmentReportCount,
    canCreateProperty: permissions.canCreateProperty,
    canGenerateReport: permissions.canGenerateReport,
    upgradeMessage:
      permissions.hasReachedLimit("maxProperties") ||
      permissions.hasReachedLimit("maxReportsPerMonth")
        ? PLAN_LIMIT_UPGRADE_MESSAGE
        : null,
    isLegacyProfile: permissions.isLegacyProfile,
    limitsActive: permissions.limitsActive,
    reportPeriodLabel: permissions.reportPeriodLabel,
    isLoading: permissions.isLoading,
    isError: permissions.isError
  };
}

export type { PlanPermissions };
