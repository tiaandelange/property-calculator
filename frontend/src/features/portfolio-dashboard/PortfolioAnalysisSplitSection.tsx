import { LockedFeaturePreview } from "../../lib/subscription/LockedFeaturePreview";
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
    <LockedFeaturePreview
      feature="portfolioDashboard"
      title="Unlock portfolio analytics with Investor."
      className="pg-pdash-analysis-split-wrap"
    >
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
    </LockedFeaturePreview>
  );
}
