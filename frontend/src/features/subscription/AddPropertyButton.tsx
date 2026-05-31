import type { CSSProperties, ReactNode } from "react";
import { ButtonLink } from "../../components/ui/Button";
import type { ButtonVariant } from "../../components/ui/buttonStyles";
import { PlanLimitUpgradePrompt } from "./PlanLimitUpgradePrompt";
import { formatPropertyLimitUsage } from "./subscriptionLimits";
import { useSubscriptionLimits } from "./useSubscriptionLimits";

type AddPropertyButtonProps = {
  variant?: ButtonVariant;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  showUsageHint?: boolean;
};

export function AddPropertyButton({
  variant = "primary",
  children = "Add Property",
  className,
  style,
  showUsageHint = false
}: AddPropertyButtonProps) {
  const limits = useSubscriptionLimits();

  if (!limits.isLoading && !limits.canCreateProperty && limits.limitsActive) {
    return <PlanLimitUpgradePrompt context="property" limits={limits} compact />;
  }

  return (
    <span className="pg-add-property-button-wrap">
      <ButtonLink href="/owned-properties/new" variant={variant} className={className} style={style}>
        {children}
      </ButtonLink>
      {showUsageHint && limits.limitsActive && limits.propertyLimit != null ? (
        <span className="pg-plan-limit-hint">
          {formatPropertyLimitUsage(limits.currentPropertyCount, limits.propertyLimit)}
        </span>
      ) : null}
    </span>
  );
}
