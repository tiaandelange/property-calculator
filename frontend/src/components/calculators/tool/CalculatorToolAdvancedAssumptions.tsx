import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

type CalculatorToolAdvancedAssumptionsProps = {
  open: boolean;
  onToggle: () => void;
  count: number;
  subtitle: string;
  children: ReactNode;
};

export function CalculatorToolAdvancedAssumptions({
  open,
  onToggle,
  count,
  subtitle,
  children
}: CalculatorToolAdvancedAssumptionsProps) {
  if (count <= 0) return null;

  return (
    <div className="pg-calc-tool-advanced">
      <button
        type="button"
        className="pg-calc-tool-advanced__trigger"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="pg-calc-tool-advanced__icon" aria-hidden>
          <SlidersHorizontal size={16} strokeWidth={2} />
        </span>
        <div className="pg-calc-tool-advanced__trigger-copy">
          <span className="pg-calc-tool-advanced__title">Advanced assumptions</span>
          <span className="pg-calc-tool-advanced__subtitle">{subtitle}</span>
          {!open ? (
            <span className="pg-calc-tool-advanced__count">
              {count} optional assumption{count === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <ChevronDown
          size={18}
          aria-hidden
          className={`pg-calc-tool-advanced__chevron${open ? " pg-calc-tool-advanced__chevron--open" : ""}`}
        />
      </button>
      <div className={`pg-calc-tool-advanced__panel${open ? " pg-calc-tool-advanced__panel--open" : ""}`}>
        <div className="pg-calc-tool-advanced__panel-inner">{children}</div>
      </div>
    </div>
  );
}
