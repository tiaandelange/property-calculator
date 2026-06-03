import type { ReactNode } from "react";
import type { FeatureKey, LimitKey } from "./planTypes";
import { UpgradePrompt } from "./UpgradePrompt";
import { usePlanPermissions } from "./usePlanPermissions";

export type LockedFeaturePreviewProps = {
  feature?: FeatureKey;
  limit?: LimitKey;
  children: ReactNode;
  /** Optional heading above the upgrade card */
  title?: string;
  message?: string;
  /** When true, render children blurred behind the upgrade prompt (default true). */
  showPreview?: boolean;
  className?: string;
  compact?: boolean;
};

/**
 * Shows children when allowed; otherwise keeps a blurred preview + UpgradePrompt (does not remove the card).
 */
export function LockedFeaturePreview({
  feature,
  limit,
  children,
  title,
  message,
  showPreview = true,
  className,
  compact = false
}: LockedFeaturePreviewProps) {
  const permissions = usePlanPermissions();

  const lockedByFeature = feature ? !permissions.canUseFeature(feature) : false;
  const lockedByLimit =
    limit != null
      ? permissions.limitsActive && permissions.hasReachedLimit(limit)
      : false;
  const locked = lockedByFeature || lockedByLimit;

  if (permissions.isLoading) {
    return <div className={className}>{children}</div>;
  }

  if (!locked) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={["pg-plan-locked", className ?? ""].filter(Boolean).join(" ")}>
      {showPreview ? (
        <div className="pg-plan-locked__preview" aria-hidden="true">
          {children}
        </div>
      ) : null}
      <div className="pg-plan-locked__overlay">
        {title ? <h3 className="pg-plan-locked__title">{title}</h3> : null}
        <UpgradePrompt
          feature={lockedByLimit ? undefined : feature}
          limit={lockedByLimit ? limit : undefined}
          message={message}
          compact={compact}
          primaryCtaLabel="Upgrade to Investor"
        />
      </div>
    </div>
  );
}
