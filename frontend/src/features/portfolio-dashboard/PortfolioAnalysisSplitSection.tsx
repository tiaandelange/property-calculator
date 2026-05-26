import { PortfolioDetailedOverviewTable } from "./PortfolioDetailedOverviewTable";
import { PortfolioSummaryProjectionChart } from "./PortfolioSummaryProjectionChart";

export function PortfolioAnalysisSplitSection({
  data,
  properties,
  propertyTypes,
  propertyId
}: {
  data: Record<string, unknown> | null | undefined;
  properties: Record<string, unknown>[];
  propertyTypes?: string[];
  propertyId?: string | number | null;
}) {
  return (
    <section className="pg-pdash-analysis-split" aria-label="Portfolio projection analysis">
      <PortfolioDetailedOverviewTable
        data={data}
        properties={properties}
        propertyTypes={propertyTypes}
        propertyId={propertyId}
      />
      <PortfolioSummaryProjectionChart
        data={data}
        properties={properties}
        propertyTypes={propertyTypes}
        propertyId={propertyId}
      />
    </section>
  );
}
