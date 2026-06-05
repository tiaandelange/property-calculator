import { ButtonLink } from "../../components/ui/Button";
import {
  formatPropertyLimitUsage,
  formatReportLimitUsage,
  PENDING_PAYMENT_BANNER_MESSAGE,
  PLAN_LIMIT_UPGRADE_MESSAGE
} from "./planFeatures";
import type { FeatureKey, LimitKey } from "./planTypes";
import { usePlanPermissions } from "./usePlanPermissions";
import { settingsSubscriptionPath } from "../../features/signup/signupBillingFlow";

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

  const pendingCheckoutHref = settingsSubscriptionPath({
    checkout: true,
    planCode: permissions.selectedPlanCode ?? undefined
  });

  const resolvedMessage =
    message ??
    (permissions.isPendingPayment
      ? PENDING_PAYMENT_BANNER_MESSAGE
      : feature
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
          <p className="pg-plan-limit-prompt__plan">
            {permissions.isPendingPayment && permissions.selectedPlanName
              ? `Selected plan: ${permissions.selectedPlanName} · Current access: ${permissions.planName}`
              : `Current plan: ${permissions.planName}`}
          </p>
        ) : null}
        <p className="pg-plan-limit-prompt__note">
          {permissions.isPendingPayment
            ? "Complete payment in Settings → Subscription to unlock your selected plan."
            : "Upgrade from Settings → Subscription or compare plans on the pricing page."}
        </p>
      </div>
      <div className="pg-plan-limit-prompt__actions">
        {permissions.isPendingPayment ? (
          <ButtonLink href={pendingCheckoutHref} variant="primary" size="sm">
            Complete payment
          </ButtonLink>
        ) : (
          <ButtonLink href={pricingHref} variant="primary" size="sm">
            {primaryCtaLabel}
          </ButtonLink>
        )}
        <ButtonLink href={subscriptionHref} variant="outline" size="sm">
          Manage plan
        </ButtonLink>
      </div>
    </div>
  );
}
