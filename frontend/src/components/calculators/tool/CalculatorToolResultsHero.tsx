import type { ReactNode } from "react";

type CalculatorToolResultsHeroProps = {
  title: string;
  primaryValue?: string;
  primarySuffix?: string;
  supportingNote?: string;
  loading?: boolean;
  emptyHint?: string;
  children?: ReactNode;
};

export function CalculatorToolResultsHero({
  title,
  primaryValue,
  primarySuffix,
  supportingNote,
  loading,
  emptyHint,
  children
}: CalculatorToolResultsHeroProps) {
  if (children) {
    return <div className="pg-calc-tool-results-hero pg-calc-tool-panel pg-calc-tool-panel--hero">{children}</div>;
  }

  return (
    <div className="pg-calc-tool-results-hero pg-calc-tool-panel pg-calc-tool-panel--hero">
      <p className="pg-calc-tool-results-hero__label">{title}</p>
      {loading ? (
        <p className="pg-calc-tool-results-hero__value">Calculating…</p>
      ) : primaryValue ? (
        <>
          <p className="pg-calc-tool-results-hero__value">
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
