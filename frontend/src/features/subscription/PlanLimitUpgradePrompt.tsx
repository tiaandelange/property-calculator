import { UpgradePrompt, type UpgradePromptContext } from "../../lib/subscription/UpgradePrompt";

type PlanLimitUpgradePromptProps = {
  context: UpgradePromptContext;
  compact?: boolean;
  message?: string;
  /** @deprecated limits prop no longer required — UpgradePrompt reads usePlanPermissions */
  limits?: unknown;
};

/** @deprecated Prefer UpgradePrompt from lib/subscription */
export function PlanLimitUpgradePrompt({
  context,
  compact = false,
  message
}: PlanLimitUpgradePromptProps) {
  return (
    <UpgradePrompt
      context={context}
      limit={context === "property" ? "maxProperties" : context === "report" ? "maxReportsPerMonth" : undefined}
      compact={compact}
      message={message}
    />
  );
}
