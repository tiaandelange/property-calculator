import type { CSSProperties, ReactNode } from "react";
import { ButtonLink } from "../../components/ui/Button";
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

  const usageHint =
    showUsageHint && permissions.limitsActive
      ? formatPropertyLimitUsage(
          permissions.usage.propertyCount,
          permissions.getLimit("maxProperties")
        )
      : null;

  return (
    <span className="pg-add-property-btn-wrap" style={style}>
      <ButtonLink href="/owned-properties/new" variant={variant} size="sm">
        {children}
      </ButtonLink>
      {usageHint ? <span className="pg-muted pg-add-property-btn-wrap__hint">{usageHint}</span> : null}
    </span>
  );
}
