import type { ReactNode } from "react";
import type { ResultTone } from "../../../utils/calculatorResultsPresentation";

type CalculatorToolResultsHeroProps = {
  title: string;
  primaryValue?: string;
  primarySuffix?: string;
  supportingNote?: string;
  tone?: ResultTone;
  badge?: string;
  loading?: boolean;
  emptyHint?: string;
  embedded?: boolean;
  children?: ReactNode;
};

export function CalculatorToolResultsHero({
  title,
  primaryValue,
  primarySuffix,
  supportingNote,
  tone = "neutral",
  badge,
  loading,
  emptyHint,
  embedded,
  children
}: CalculatorToolResultsHeroProps) {
  const rootClass = [
    "pg-calc-tool-results-hero",
    embedded ? "pg-calc-tool-results-hero--embedded" : "pg-calc-tool-panel pg-calc-tool-panel--hero"
  ].join(" ");

  if (children) {
    return <div className={rootClass}>{children}</div>;
  }

  return (
    <div className={rootClass}>
      <div className="pg-calc-tool-results-hero__head">
        <p className="pg-calc-tool-results-hero__label">{title}</p>
        {badge && !loading && primaryValue ? (
          <span className={`pg-calc-tool-results-badge pg-calc-tool-results-badge--${tone}`}>{badge}</span>
        ) : null}
      </div>
      {loading ? (
        <p className="pg-calc-tool-results-hero__value">Calculating…</p>
      ) : primaryValue ? (
        <>
          <p className={`pg-calc-tool-results-hero__value pg-calc-tool-results-hero__value--${tone}`}>
            {primaryValue}
            {primarySuffix ? <span className="pg-calc-tool-results-hero__suffix">{primarySuffix}</span> : null}
          </p>
          {supportingNote ? <p className="pg-calc-tool-results-hero__support">{supportingNote}</p> : null}
        </>
      ) : (
        <p className="pg-calc-tool-results-hero__placeholder">{emptyHint ?? "Run the calculator to see your result."}</p>
      )}
    </div>
  );
}
