import type { ReactNode } from "react";

export type CalculatorToolMetric = {
  label: string;
  value: string;
};

type CalculatorToolResultsHeroProps = {
  title: string;
  primaryValue?: string;
  primarySuffix?: string;
  metrics?: CalculatorToolMetric[];
  loading?: boolean;
  emptyHint?: string;
  children?: ReactNode;
};

export function CalculatorToolResultsHero({
  title,
  primaryValue,
  primarySuffix,
  metrics = [],
  loading,
  emptyHint,
  children
}: CalculatorToolResultsHeroProps) {
  if (children) {
    return <div className="pg-calc-tool-results-hero">{children}</div>;
  }

  return (
    <div className="pg-calc-tool-results-hero">
      <p className="pg-calc-tool-results-hero__label">{title}</p>
      {loading ? (
        <p className="pg-calc-tool-results-hero__value">Calculating…</p>
      ) : primaryValue ? (
        <p className="pg-calc-tool-results-hero__value">
          {primaryValue}
          {primarySuffix ? <span className="pg-calc-tool-results-hero__suffix">{primarySuffix}</span> : null}
        </p>
      ) : (
        <p className="pg-calc-tool-results-hero__placeholder">{emptyHint ?? "Run the calculator to see your result."}</p>
      )}
      {metrics.length > 0 ? (
        <div className="pg-calc-tool-results-hero__metrics pg-calc-tool-results-hero__metrics--grid" role="list">
          {metrics.map((m) => (
            <div key={m.label} className="pg-calc-tool-results-hero__metric" role="listitem">
              <span className="pg-calc-tool-results-hero__metric-label">{m.label}</span>
              <span className="pg-calc-tool-results-hero__metric-value">{m.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
