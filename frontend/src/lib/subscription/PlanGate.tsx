import type { ReactNode } from "react";
import type { FeatureKey } from "./planTypes";
import { UpgradePrompt } from "./UpgradePrompt";
import { usePlanPermissions } from "./usePlanPermissions";

export type PlanGateProps = {
  feature: FeatureKey;
  children: ReactNode;
  /** Rendered when the feature is not allowed (defaults to UpgradePrompt). */
  fallback?: ReactNode;
  /** Hide children while subscription data is loading (default: true). */
  hideWhileLoading?: boolean;
};

/**
 * Renders children only when the current plan includes `feature`.
 * Admin users always pass. Use this instead of inline plan checks in pages.
 */
export function PlanGate({
  feature,
  children,
  fallback,
  hideWhileLoading = true
}: PlanGateProps) {
  const { canUseFeature, isLoading, isAdmin } = usePlanPermissions();

  if (isLoading && hideWhileLoading) {
    return null;
  }

  if (isAdmin || canUseFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return <UpgradePrompt feature={feature} context="feature" compact />;
}
