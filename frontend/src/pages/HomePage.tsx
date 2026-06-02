import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scheduleMarketingHashScroll } from "../lib/marketingHashScroll";
import { HomePageSeo } from "../components/home/marketing/HomePageSeo";
import { HomeMarketingCalculatorsSection } from "../components/home/marketing/HomeMarketingCalculatorsSection";
import { HomeMarketingFaqSection } from "../components/home/marketing/HomeMarketingFaqSection";
import { HomeMarketingFeatureHighlights } from "../components/home/marketing/HomeMarketingFeatureHighlights";
import { HomeMarketingFinalCta } from "../components/home/marketing/HomeMarketingFinalCta";
import { HomeMarketingHero } from "../components/home/marketing/HomeMarketingHero";
import { HomeMarketingManagementSection } from "../components/home/marketing/HomeMarketingManagementSection";
import { HomeMarketingPricingPreview } from "../components/home/marketing/HomeMarketingPricingPreview";
import { HomeMarketingProblemSection } from "../components/home/marketing/HomeMarketingProblemSection";
import { HomeMarketingReportsSection } from "../components/home/marketing/HomeMarketingReportsSection";
import { HomeMarketingSolutionSection } from "../components/home/marketing/HomeMarketingSolutionSection";
import { HomeMarketingTrustStrip } from "../components/home/marketing/HomeMarketingTrustStrip";

export function HomePage() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    return scheduleMarketingHashScroll(location.hash);
  }, [location.hash, location.pathname]);

  return (
    <>
      <HomePageSeo />

      <div className="pg-home hm-home" id="home">
        <HomeMarketingHero />
        <HomeMarketingTrustStrip />
        <HomeMarketingProblemSection />
        <HomeMarketingSolutionSection />
        <HomeMarketingFeatureHighlights />
        <HomeMarketingReportsSection />
        <HomeMarketingCalculatorsSection />
        <HomeMarketingManagementSection />
        <HomeMarketingPricingPreview />
        <HomeMarketingFaqSection />
        <HomeMarketingFinalCta />
      </div>
    </>
  );
}
