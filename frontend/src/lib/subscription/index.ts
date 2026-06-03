export {
  PLAN_CODES,
  FEATURE_KEYS,
  LIMIT_KEYS,
  type PlanCode,
  type FeatureKey,
  type LimitKey,
  type PlanLimits,
  type PlanFeatures,
  type PlanPermissionsInput,
  type PlanPermissionsSnapshot
} from "./planTypes";

export {
  computePlanPermissions,
  computeSubscriptionLimits,
  type ComputedSubscriptionLimits,
  canUseFeatureFromSnapshot,
  getLimitFromSnapshot,
  hasReachedLimitFromSnapshot,
  requireFeatureFromSnapshot,
  upgradeMessageFor,
  upgradeMessageForFeature,
  upgradeMessageForLimit,
  formatPropertyLimitUsage,
  formatReportLimitUsage,
  PLAN_LIMIT_UPGRADE_MESSAGE,
  DEFAULT_UPGRADE_MESSAGE,
  PlanPermissionError
} from "./planFeatures";

export {
  useSubscriptionQuery,
  useSubscriptionDashboardQuery,
  type SubscriptionQueryData,
  type SubscriptionDashboardData
} from "./useSubscriptionQuery";

export { usePlanPermissions, type PlanPermissions } from "./usePlanPermissions";

export { PlanGate, type PlanGateProps } from "./PlanGate";

export { UpgradePrompt, type UpgradePromptProps, type UpgradePromptContext } from "./UpgradePrompt";

export { LockedFeaturePreview, type LockedFeaturePreviewProps } from "./LockedFeaturePreview";
export {
  canCreateApplicationLinkFromSnapshot,
  getCalculatorPlanGateFeature
} from "./planGatingHelpers";
