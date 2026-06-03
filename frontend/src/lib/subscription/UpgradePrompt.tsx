import { ButtonLink } from "../../components/ui/Button";
import {
  formatPropertyLimitUsage,
  formatReportLimitUsage,
  PLAN_LIMIT_UPGRADE_MESSAGE
} from "./planFeatures";
import type { FeatureKey, LimitKey } from "./planTypes";
import { usePlanPermissions } from "./usePlanPermissions";

export type UpgradePromptContext = "property" | "report" | "feature" | "general";

export type UpgradePromptProps = {
  /** Shorthand for limit-based prompts */
  context?: UpgradePromptContext;
  feature?: FeatureKey;
  limit?: LimitKey;
  compact?: boolean;
  message?: string;
  className?: string;
  /** Primary CTA label (defaults to Upgrade to Investor). */
  primaryCtaLabel?: string;
  pricingHref?: string;
  subscriptionHref?: string;
};

export function UpgradePrompt({
  context = "general",
  feature,
  limit,
  compact = false,
  message,
  className,
  primaryCtaLabel = "Upgrade to Investor",
  pricingHref = "/pricing",
  subscriptionHref = "/settings?section=subscription"
}: UpgradePromptProps) {
  const permissions = usePlanPermissions();

  const resolvedMessage =
    message ??
    (feature
      ? permissions.upgradeMessage(feature)
      : limit
        ? permissions.upgradeMessage(undefined, limit)
        : PLAN_LIMIT_UPGRADE_MESSAGE);

  const usageLine =
    context === "property" || limit === "maxProperties"
      ? formatPropertyLimitUsage(
          permissions.usage.propertyCount,
          permissions.getLimit("maxProperties")
        )
      : context === "report" || limit === "maxReportsPerMonth"
        ? formatReportLimitUsage(
            permissions.usage.investmentReportCount,
            permissions.getLimit("maxReportsPerMonth"),
            permissions.reportPeriodLabel
          )
        : null;

  return (
    <div
      className={[
        "pg-plan-limit-prompt",
        compact ? "pg-plan-limit-prompt--compact" : "",
        className ?? ""
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
    >
      <div className="pg-plan-limit-prompt__body">
        <p className="pg-plan-limit-prompt__message">{resolvedMessage}</p>
        {permissions.limitsActive && usageLine ? (
          <p className="pg-plan-limit-prompt__usage">{usageLine}</p>
        ) : null}
        {permissions.planName && !permissions.isAdmin ? (
          <p className="pg-plan-limit-prompt__plan">Current plan: {permissions.planName}</p>
        ) : null}
        <p className="pg-plan-limit-prompt__note">
          Payment processing is not live yet — limits are informational and may change when billing
          launches.
        </p>
      </div>
      <div className="pg-plan-limit-prompt__actions">
        <ButtonLink href={pricingHref} variant="primary" size="sm">
          {primaryCtaLabel}
        </ButtonLink>
        <ButtonLink href={subscriptionHref} variant="outline" size="sm">
          Manage plan
        </ButtonLink>
      </div>
    </div>
  );
}
