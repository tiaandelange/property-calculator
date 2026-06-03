import { useCallback, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  canUseFeatureFromSnapshot,
  computePlanPermissions,
  defaultUsageForLimit,
  getLimitFromSnapshot,
  hasReachedLimitFromSnapshot,
  PlanPermissionError,
  requireFeatureFromSnapshot,
  upgradeMessageFor
} from "./planFeatures";
import { canCreateApplicationLinkFromSnapshot } from "./planGatingHelpers";
import type { FeatureKey, LimitKey, PlanFeatures, PlanLimits, PlanPermissionsSnapshot } from "./planTypes";
import { useSubscriptionQuery } from "./useSubscriptionQuery";

export type PlanPermissions = PlanPermissionsSnapshot & {
  isLoading: boolean;
  isError: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
  canUseFeature: (featureKey: FeatureKey) => boolean;
  hasReachedLimit: (limitKey: LimitKey, currentUsage?: number) => boolean;
  getLimit: (limitKey: LimitKey) => number | null;
  requireFeature: (featureKey: FeatureKey) => void;
  upgradeMessage: (featureKey?: FeatureKey, limitKey?: LimitKey) => string;
  /** Convenience: property cap not reached */
  canCreateProperty: boolean;
  /** Convenience: monthly report cap not reached */
  canGenerateReport: boolean;
  /** Convenience: tenant application invite link allowed */
  canCreateApplicationLink: boolean;
};

export function usePlanPermissions(): PlanPermissions {
  const { profile } = useAuth();
  const { data, isLoading, isError } = useSubscriptionQuery();

  const snapshot = useMemo(
    () =>
      computePlanPermissions({
        plans: data?.plans ?? [],
        subscription: data?.subscription ?? null,
        usage: data?.usage ?? null,
        freeUsesRemaining: profile?.free_uses_remaining,
        role: profile?.role
      }),
    [data?.plans, data?.subscription, data?.usage, profile?.free_uses_remaining, profile?.role]
  );

  const canUseFeature = useCallback(
    (featureKey: FeatureKey) => canUseFeatureFromSnapshot(snapshot, featureKey),
    [snapshot]
  );

  const getLimit = useCallback(
    (limitKey: LimitKey) => getLimitFromSnapshot(snapshot, limitKey),
    [snapshot]
  );

  const hasReachedLimit = useCallback(
    (limitKey: LimitKey, currentUsage?: number) => {
      const usage =
        currentUsage ?? defaultUsageForLimit(snapshot, limitKey);
      return hasReachedLimitFromSnapshot(snapshot, limitKey, usage);
    },
    [snapshot]
  );

  const requireFeature = useCallback(
    (featureKey: FeatureKey) => requireFeatureFromSnapshot(snapshot, featureKey),
    [snapshot]
  );

  const upgradeMessage = useCallback(
    (featureKey?: FeatureKey, limitKey?: LimitKey) =>
      upgradeMessageFor(snapshot, featureKey, limitKey),
    [snapshot]
  );

  const canCreateProperty = !hasReachedLimitFromSnapshot(
    snapshot,
    "maxProperties",
    snapshot.usage.propertyCount
  );
  const canGenerateReport = !hasReachedLimitFromSnapshot(
    snapshot,
    "maxReportsPerMonth",
    snapshot.usage.investmentReportCount
  );
  const canCreateApplicationLink = canCreateApplicationLinkFromSnapshot(snapshot);

  return {
    ...snapshot,
    isLoading,
    isError,
    canUseFeature,
    hasReachedLimit,
    getLimit,
    requireFeature,
    upgradeMessage,
    canCreateProperty,
    canGenerateReport,
    canCreateApplicationLink
  };
}

export { PlanPermissionError };
