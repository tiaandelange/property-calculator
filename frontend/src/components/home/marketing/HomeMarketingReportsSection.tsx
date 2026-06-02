import { homepageReports } from "../../../data/homepageMarketingContent";
import { ButtonLink } from "../../ui/Button";
import { HomeMarketingReportPreviewMock } from "./HomeMarketingReportPreviewMock";
import { HomeMarketingSection, HomeMarketingSectionHeader } from "./HomeMarketingSection";

export function HomeMarketingReportsSection() {
  return (
    <HomeMarketingSection id="reports" className="hm-section--reports">
      <HomeMarketingSectionHeader title={homepageReports.title} lead={homepageReports.lead} align="center" />

      <div className="hm-reports-spotlight">
        <div className="hm-reports-spotlight__copy">
          <ul className="hm-reports-features">
            {homepageReports.features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="hm-reports-spotlight__ctas">
            <ButtonLink href={homepageReports.primaryCta.href} variant="primary">
              {homepageReports.primaryCta.label}
            </ButtonLink>
            <ButtonLink href={homepageReports.secondaryCta.href} variant="secondary">
              {homepageReports.secondaryCta.label}
            </ButtonLink>
          </div>
        </div>
        <HomeMarketingReportPreviewMock />
      </div>
    </HomeMarketingSection>
  );
}
