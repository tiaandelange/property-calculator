import type { CSSProperties, ReactNode } from "react";
import { ButtonLink, type ButtonSize } from "../../components/ui/Button";
import { UpgradePrompt } from "../../lib/subscription/UpgradePrompt";
import { usePlanPermissions } from "../../lib/subscription/usePlanPermissions";
import { formatPropertyLimitUsage } from "../../lib/subscription/planFeatures";

type AddPropertyButtonProps = {
  variant?: "primary" | "soft";
  size?: ButtonSize;
  showUsageHint?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function AddPropertyButton({
  variant = "primary",
  size = "md",
  showUsageHint = false,
  className,
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
    <span className={["pg-add-property-btn-wrap", className].filter(Boolean).join(" ")} style={style}>
      <ButtonLink href="/owned-properties/new" variant={variant} size={size}>
        {children}
      </ButtonLink>
      {usageHint ? <span className="pg-add-property-btn-wrap__hint">{usageHint}</span> : null}
    </span>
  );
}
