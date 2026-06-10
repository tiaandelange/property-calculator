import { describe, expect, it } from "vitest";

import {
  homepageFinalCta,
  homepageHero,
  homepageInlineCta,
  homepagePricingPreviewPlans,
  homepagePublicCalculators,
  MARKETING_CTA_JOIN_FREE,
  MARKETING_PUBLIC_CALCULATORS_HREF,
  MARKETING_SIGNUP_FREE_HREF
} from "./homepageMarketingContent";

const MARKETING_JSON = JSON.stringify({
  hero: homepageHero,
  inline: homepageInlineCta,
  calculators: homepagePublicCalculators,
  final: homepageFinalCta,
  plans: homepagePricingPreviewPlans
});

describe("homepageMarketingContent", () => {
  it("provides shorter mobile hero copy variants", () => {
    expect(homepageHero.eyebrowMobile).toBe("FOR OWNER-MANAGERS");
    expect(homepageHero.eyebrow).toBe("FOR OWNER-MANAGERS");
    expect(homepageHero.headlineMobile).toContain("Track Your Property Portfolio");
    expect(homepageHero.headlineMobile).not.toContain("actually");
    expect(homepageHero.headline).not.toContain("actually");
    expect(homepageHero.headlineDesktopLines).toEqual([
      "Track Your Property Portfolio",
      "Net Worth, Cash Flow and Investment Returns"
    ]);
    expect(homepageHero.featureChips).toEqual([
      "Portfolio analytics",
      "Rental admin",
      "Investor-ready reports"
    ]);
  });

  it("uses Join Free and starter signup for free-plan CTAs", () => {
    expect(homepageHero.primaryCta).toEqual(MARKETING_CTA_JOIN_FREE);
    expect(homepageFinalCta.primary).toEqual(MARKETING_CTA_JOIN_FREE);
    expect(homepageInlineCta.afterPricing.primary).toEqual(MARKETING_CTA_JOIN_FREE);
    expect(homepagePricingPreviewPlans.find((p) => p.code === "starter")?.cta).toEqual(MARKETING_CTA_JOIN_FREE);
  });

  it("does not link public marketing copy to the signed-in calculator route", () => {
    expect(MARKETING_JSON).not.toContain("/investment-calculator");
    expect(MARKETING_JSON).not.toContain("/dashboard");
  });

  it("routes public calculators to the calculator hub", () => {
    expect(homepagePublicCalculators.cta.href).toBe(MARKETING_PUBLIC_CALCULATORS_HREF);
    expect(MARKETING_PUBLIC_CALCULATORS_HREF).toBe("/calculators");
  });

  it("avoids trial-oriented signup CTAs on the homepage", () => {
    expect(MARKETING_JSON.toLowerCase()).not.toMatch(/free trial|start free trial|start trial/);
    expect(MARKETING_SIGNUP_FREE_HREF).toBe("/signup?plan=starter");
  });
});
