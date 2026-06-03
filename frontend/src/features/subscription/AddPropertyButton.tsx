import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { UpgradePrompt } from "../../lib/subscription/UpgradePrompt";
import { usePlanPermissions } from "../../lib/subscription/usePlanPermissions";
import { formatPropertyLimitUsage } from "../../lib/subscription/planFeatures";

type AddPropertyButtonProps = {
  variant?: "primary" | "soft";
  showUsageHint?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
};

export function AddPropertyButton({
  variant = "primary",
  showUsageHint = false,
  style,
  children = "Add property"
}: AddPropertyButtonProps) {
  const permissions = usePlanPermissions();

  if (!permissions.isLoading && permissions.limitsActive && !permissions.canCreateProperty) {
    return <UpgradePrompt context="property" limit="maxProperties" compact />;
  }

  const className =
    variant === "soft" ? "pg-btn pg-btn--soft pg-btn--sm" : "pg-btn pg-btn--primary pg-btn--sm";

  const usageHint =
    showUsageHint && permissions.limitsActive
      ? formatPropertyLimitUsage(
          permissions.usage.propertyCount,
          permissions.getLimit("maxProperties")
        )
      : null;

  return (
    <span className="pg-add-property-btn-wrap" style={style}>
      <Link to="/owned-properties/new" className={className}>
        {children}
      </Link>
      {usageHint ? <span className="pg-muted pg-add-property-btn-wrap__hint">{usageHint}</span> : null}
    </span>
  );
}
