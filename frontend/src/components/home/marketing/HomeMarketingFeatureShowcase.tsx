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
    <div className="hm-showcase" aria-label="Proplytic product module previews">
      <div className="hm-showcase__item hm-showcase__item--portfolio">
        <HomeMarketingPortfolioPreview />
      </div>
      <div className="hm-showcase__item hm-showcase__item--property">
        <HomeMarketingPropertyPreview />
      </div>
      <div className="hm-showcase__item hm-showcase__item--statement">
        <HomeMarketingStatementPreview />
      </div>
      <div className="hm-showcase__item hm-showcase__item--invoice">
        <HomeMarketingInvoicePreview />
      </div>
      <div className="hm-showcase__item hm-showcase__item--report">
        <HomeMarketingPreviewModuleLabel>{homepagePreviewReport.moduleLabel}</HomeMarketingPreviewModuleLabel>
        <HomeMarketingReportPreviewMock />
      </div>
      <div className="hm-showcase__item hm-showcase__item--calculator">
        <HomeMarketingCalculatorPreview />
      </div>
    </div>
  );
}
