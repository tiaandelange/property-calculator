import { Button } from "../../ui/Button";
import { PlanLimitUpgradePrompt } from "../../../features/subscription/PlanLimitUpgradePrompt";
import { formatReportLimitUsage } from "../../../features/subscription/subscriptionLimits";
import type { useSubscriptionLimits } from "../../../features/subscription/useSubscriptionLimits";

type CalculatorToolFormActionsProps = {
  loading: boolean;
  calcSlug: string;
  onReset: () => void;
  savedId?: string | number | null;
  pdfBusy?: boolean;
  onPdf?: () => void;
  subscriptionLimits: ReturnType<typeof useSubscriptionLimits>;
  submitLabel?: string;
};

export function CalculatorToolFormActions({
  loading,
  calcSlug,
  onReset,
  savedId,
  pdfBusy,
  onPdf,
  subscriptionLimits,
  submitLabel
}: CalculatorToolFormActionsProps) {
  return (
    <div className="pg-calc-tool-form-actions">
      <div className="pg-calc-tool-form-actions__primary-row">
        <Button type="submit" loading={loading} className="pg-calc-tool-form-actions__calc">
          {submitLabel ?? (calcSlug === "noi" ? "Calculate NOI" : "Calculate")}
        </Button>
        <Button type="button" variant="secondary" onClick={onReset} className="pg-calc-tool-form-actions__reset">
          Reset
        </Button>
      </div>
      {savedId ? (
        <div className="pg-calc-tool-form-actions__utility-row">
          {!subscriptionLimits.canGenerateReport && subscriptionLimits.limitsActive ? (
            <PlanLimitUpgradePrompt context="report" limits={subscriptionLimits} compact />
          ) : (
            <Button type="button" variant="ghost" className="pg-calc-tool-form-actions__pdf" onClick={onPdf} loading={pdfBusy}>
              PDF
            </Button>
          )}
        </div>
      ) : null}
      {subscriptionLimits.limitsActive && savedId ? (
        <p className="pg-plan-limit-hint pg-calc-tool-form-actions__limit-hint">
          {formatReportLimitUsage(
            subscriptionLimits.currentReportCount,
            subscriptionLimits.reportLimit,
            subscriptionLimits.reportPeriodLabel
          )}
        </p>
      ) : null}
    </div>
  );
}
