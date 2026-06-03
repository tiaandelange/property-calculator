import { homepageReports } from "../../../data/homepageMarketingContent";
import { HomeMarketingConversionHeader } from "./HomeMarketingConversionHeader";
import { HomeMarketingReportPreviewMock } from "./HomeMarketingReportPreviewMock";
import { HomeMarketingSection } from "./HomeMarketingSection";

export function HomeMarketingReportsSection() {
  const content = homepageReports;

  return (
    <HomeMarketingSection id="reports" className="hm-section--reports">
      <HomeMarketingConversionHeader
        eyebrow={content.eyebrow}
        pain={content.pain}
        title={content.title}
        benefit={content.benefit}
      />

      <div className="hm-reports-spotlight">
        <div className="hm-reports-spotlight__copy">
          <ul className="hm-outcome-grid hm-outcome-grid--stacked hm-conv-cards">
            {content.outcomes.map((item) => (
              <li key={item.title} className="hm-outcome-card hm-outcome-card--compact">
                <h3 className="hm-outcome-card__title">{item.title}</h3>
                <p className="hm-outcome-card__body">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <HomeMarketingReportPreviewMock />
      </div>

    </HomeMarketingSection>
  );
}
