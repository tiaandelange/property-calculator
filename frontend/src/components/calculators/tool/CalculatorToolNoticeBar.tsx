import { Info } from "lucide-react";

export function CalculatorToolNoticeBar() {
  return (
    <div className="pg-calc-tool-notice" role="note">
      <Info className="pg-calc-tool-notice__icon" size={18} strokeWidth={2} aria-hidden />
      <p className="pg-calc-tool-notice__text">
        All calculations are estimates. Results may vary based on your lender, actual fees, rates and personal
        circumstances.
      </p>
    </div>
  );
}
