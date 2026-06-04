import { Button } from "../../ui/Button";

type CalculatorToolStickyBarProps = {
  formId: string;
  onReset: () => void;
  loading?: boolean;
};

export function CalculatorToolStickyBar({ formId, onReset, loading }: CalculatorToolStickyBarProps) {
  return (
    <div className="pg-calc-tool-sticky-bar" role="group" aria-label="Calculator actions">
      <Button type="submit" form={formId} loading={loading} fullWidth>
        Calculate
      </Button>
      <Button type="button" variant="secondary" onClick={onReset} fullWidth>
        Reset
      </Button>
    </div>
  );
}
