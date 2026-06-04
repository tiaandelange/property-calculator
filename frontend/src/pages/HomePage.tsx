import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scheduleMarketingHashScroll } from "../lib/marketingHashScroll";
import { homepageInlineCta, homepageMarketingStatsBands } from "../data/homepageMarketingContent";
import { HomePageSeo } from "../components/home/marketing/HomePageSeo";
import { HomeMarketingCalculatorsSection } from "../components/home/marketing/HomeMarketingCalculatorsSection";
import { HomeMarketingFaqSection } from "../components/home/marketing/HomeMarketingFaqSection";
import { HomeMarketingFeatureHighlights } from "../components/home/marketing/HomeMarketingFeatureHighlights";
import { HomeMarketingFinalCta } from "../components/home/marketing/HomeMarketingFinalCta";
import { HomeMarketingHero } from "../components/home/marketing/HomeMarketingHero";
import { HomeMarketingInlineCta } from "../components/home/marketing/HomeMarketingInlineCta";
import { HomeMarketingPricingPreview } from "../components/home/marketing/HomeMarketingPricingPreview";
import { HomeMarketingProblemSection } from "../components/home/marketing/HomeMarketingProblemSection";
import { HomeMarketingReportsSection } from "../components/home/marketing/HomeMarketingReportsSection";
import { HomeMarketingSolutionSection } from "../components/home/marketing/HomeMarketingSolutionSection";
import { HomeMarketingStatsBand } from "../components/home/marketing/HomeMarketingStatsBand";
import { HomeMarketingTrustStrip } from "../components/home/marketing/HomeMarketingTrustStrip";
import { HomeMarketingWhoItsFor } from "../components/home/marketing/HomeMarketingWhoItsFor";
import { HomeMarketingWhyProplytic } from "../components/home/marketing/HomeMarketingWhyProplytic";

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
        <HomeMarketingStatsBand {...homepageMarketingStatsBands[0]} />
        <HomeMarketingTrustStrip />
        <HomeMarketingWhoItsFor />
        <HomeMarketingWhyProplytic />
        <HomeMarketingProblemSection />
        <HomeMarketingStatsBand {...homepageMarketingStatsBands[1]} />
        <HomeMarketingSolutionSection />
        <HomeMarketingFeatureHighlights />
        <HomeMarketingStatsBand {...homepageMarketingStatsBands[2]} />
        <HomeMarketingReportsSection />
        <HomeMarketingCalculatorsSection />
        <HomeMarketingPricingPreview />
        <HomeMarketingInlineCta {...homepageInlineCta.afterPricing} />
        <HomeMarketingFaqSection />
        <HomeMarketingFinalCta />
      </div>
    </>
  );
}

