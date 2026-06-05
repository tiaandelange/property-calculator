import { ChevronDown, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import type { CalculatorInputSummaryRow } from "../../../utils/formatCalculatorInputSummary";
import { Button } from "../../ui/Button";

type CalculatorToolInputsAccordionProps = {
  summaryRows: CalculatorInputSummaryRow[];
  expanded: boolean;
  onToggleExpanded: () => void;
  isMobile: boolean;
  children: ReactNode;
};

export function CalculatorToolInputsAccordion({
  summaryRows,
  expanded,
  onToggleExpanded,
  isMobile,
  children
}: CalculatorToolInputsAccordionProps) {
  if (!isMobile) {
    return (
      <div className="pg-calc-tool-panel pg-calc-tool-panel--inputs">
        <h2 className="pg-calc-tool-panel__title">Your inputs</h2>
        {children}
      </div>
    );
  }

  return (
    <div className="pg-calc-tool-panel pg-calc-tool-panel--inputs pg-calc-tool-panel--inputs-mobile">
      <div className="pg-calc-tool-inputs-accordion__head">
        <h2 className="pg-calc-tool-panel__title">Your inputs</h2>
        {expanded ? (
          <button
            type="button"
            className="pg-calc-tool-inputs-accordion__collapse"
            onClick={onToggleExpanded}
            aria-expanded="true"
          >
            Collapse
            <ChevronDown size={16} aria-hidden className="pg-calc-tool-inputs-accordion__chevron pg-calc-tool-inputs-accordion__chevron--open" />
          </button>
        ) : null}
      </div>

      {!expanded && summaryRows.length > 0 ? (
        <ul className="pg-calc-tool-input-summary" aria-label="Current inputs">
          {summaryRows.map((row) => (
            <li key={row.key} className="pg-calc-tool-input-summary__row">
              <span className="pg-calc-tool-input-summary__label">{row.label}</span>
              <span className="pg-calc-tool-input-summary__value">{row.displayValue}</span>
              <Pencil size={14} className="pg-calc-tool-input-summary__edit" aria-hidden />
            </li>
          ))}
        </ul>
      ) : null}

      {!expanded ? (
        <Button type="button" variant="secondary" fullWidth className="pg-calc-tool-inputs-accordion__edit-btn" onClick={onToggleExpanded}>
          Edit Inputs
        </Button>
      ) : null}

      <div
        className="pg-calc-tool-inputs-accordion__body"
        data-expanded={expanded ? "true" : "false"}
        hidden={!expanded}
      >
        {children}
      </div>
    </div>
  );
}
