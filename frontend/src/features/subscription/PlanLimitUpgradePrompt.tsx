import { ButtonLink } from "../../components/ui/Button";
import type { SubscriptionLimits } from "./useSubscriptionLimits";
import {
  formatPropertyLimitUsage,
  formatReportLimitUsage,
  PLAN_LIMIT_UPGRADE_MESSAGE
} from "./subscriptionLimits";

type PlanLimitUpgradePromptProps = {
  context: "property" | "report" | "general";
  limits: Pick<
    SubscriptionLimits,
    | "planName"
    | "propertyLimit"
    | "reportLimit"
    | "currentPropertyCount"
    | "currentReportCount"
    | "reportPeriodLabel"
    | "limitsActive"
  >;
  compact?: boolean;
  message?: string;
};

export function PlanLimitUpgradePrompt({
  context,
  limits,
  compact = false,
  message = PLAN_LIMIT_UPGRADE_MESSAGE
}: PlanLimitUpgradePromptProps) {
  const usageLine =
    context === "property"
      ? formatPropertyLimitUsage(limits.currentPropertyCount, limits.propertyLimit)
      : context === "report"
        ? formatReportLimitUsage(
            limits.currentReportCount,
            limits.reportLimit,
            limits.reportPeriodLabel
          )
        : null;

  return (
    <div
      className={`pg-plan-limit-prompt${compact ? " pg-plan-limit-prompt--compact" : ""}`}
      role="status"
    >
      <div className="pg-plan-limit-prompt__body">
        <p className="pg-plan-limit-prompt__message">{message}</p>
        {limits.limitsActive && usageLine ? (
          <p className="pg-plan-limit-prompt__usage">{usageLine}</p>
        ) : null}
        <p className="pg-plan-limit-prompt__note">
          Payment processing is not live yet — limits are informational and may change when billing
          launches.
        </p>
      </div>
      <div className="pg-plan-limit-prompt__actions">
        <ButtonLink href="/pricing" variant="primary" size="sm">
          View plans
        </ButtonLink>
        <ButtonLink href="/settings?section=subscription" variant="outline" size="sm">
          Manage plan
        </ButtonLink>
      </div>
    </div>
  );
}
