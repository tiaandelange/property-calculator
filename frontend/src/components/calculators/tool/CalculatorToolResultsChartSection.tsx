import type { ReactNode } from "react";
import { LockedFeaturePreview } from "../../../lib/subscription/LockedFeaturePreview";

type CalculatorToolResultsChartSectionProps = {
  title: string;
  children: ReactNode;
};

export function CalculatorToolResultsChartSection({ title, children }: CalculatorToolResultsChartSectionProps) {
  return (
    <section className="pg-calc-tool-results-section pg-calc-tool-results-section--chart" aria-label={title}>
      <h3 className="pg-calc-tool-results-section__title">{title}</h3>
      <LockedFeaturePreview
        feature="graphs"
        className="pg-calc-tool-chart-lock"
        title="Unlock charts with Investor"
        message="Charts and graphs require an Investor plan or higher."
        showPreview
      >
        <div className="pg-calc-tool-chart-lock__body">{children}</div>
      </LockedFeaturePreview>
    </section>
  );
}
