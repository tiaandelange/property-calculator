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
    expect(homepageHero.headlineMobile).toContain("Stop spreadsheet chaos");
    expect(homepageHero.headlineMobile).not.toContain("actually");
  });

  it("uses Join Free and starter signup for free-plan CTAs", () => {
    expect(homepageHero.primaryCta).toEqual(MARKETING_CTA_JOIN_FREE);
    expect(homepageFinalCta.primary).toEqual(MARKETING_CTA_JOIN_FREE);
    expect(homepageInlineCta.default.primary).toEqual(MARKETING_CTA_JOIN_FREE);
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
