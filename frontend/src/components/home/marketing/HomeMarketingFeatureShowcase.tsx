import { homepagePreviewReport } from "../../../data/homepagePreviewContent";
import {
  HomeMarketingCalculatorPreview,
  HomeMarketingInvoicePreview,
  HomeMarketingPortfolioPreview,
  HomeMarketingPropertyPreview,
  HomeMarketingStatementPreview
} from "./HomeMarketingModulePreviews";
import { HomeMarketingPreviewModuleLabel } from "./HomeMarketingPreviewShell";
import { HomeMarketingReportPreviewMock } from "./HomeMarketingReportPreviewMock";

export function HomeMarketingFeatureShowcase() {
  return (
    <div className="hm-showcase hm-showcase--structured" aria-label="Proplytic product module previews">
      <div className="hm-showcase__row hm-showcase__row--overview">
        <div className="hm-showcase__cell hm-showcase__cell--portfolio">
          <HomeMarketingPortfolioPreview />
        </div>
      </div>

      <div className="hm-showcase__row hm-showcase__row--pair">
        <div className="hm-showcase__cell hm-showcase__cell--property">
          <HomeMarketingPropertyPreview />
        </div>
        <div className="hm-showcase__cell hm-showcase__cell--statement">
          <HomeMarketingStatementPreview />
        </div>
      </div>

      <div className="hm-showcase__row hm-showcase__row--pair">
        <div className="hm-showcase__cell hm-showcase__cell--invoice">
          <HomeMarketingInvoicePreview />
        </div>
        <div className="hm-showcase__cell hm-showcase__cell--report">
          <HomeMarketingPreviewModuleLabel>{homepagePreviewReport.moduleLabel}</HomeMarketingPreviewModuleLabel>
          <HomeMarketingReportPreviewMock />
        </div>
      </div>

      <div className="hm-showcase__row hm-showcase__row--calculator">
        <div className="hm-showcase__cell hm-showcase__cell--calculator">
          <HomeMarketingCalculatorPreview />
        </div>
      </div>
    </div>
  );
}
