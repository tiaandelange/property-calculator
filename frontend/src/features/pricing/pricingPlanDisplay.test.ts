import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../../services/subscriptionPlansSupabase";
import {
  planBestFor,
  planCardFeatureLines,
  planCta,
  planPriceHeadline,
  planPriceSubline,
  planReportLimitLabel,
  planSecondaryCta,
  planHasTrialPeriod,
  starterShowsFreeTrial
} from "./pricingPlanDisplay";

function plan(code: string) {
  const match = FALLBACK_SUBSCRIPTION_PLANS.find((p) => p.code === code);
  if (!match) throw new Error(`missing plan ${code}`);
  return match;
}

describe("pricingPlanDisplay QA", () => {
  it("lists four fallback tiers", () => {
    expect(FALLBACK_SUBSCRIPTION_PLANS.map((p) => p.code)).toEqual([
      "starter",
      "investor",
      "portfolio",
      "portfolio_pro"
    ]);
  });

  it("shows starter as FREE without a trial period", () => {
    expect(planPriceHeadline(plan("starter"))).toBe("FREE");
    expect(planPriceSubline(plan("starter"))).toContain("Always free");
    expect(planHasTrialPeriod(plan("starter"))).toBe(false);
    expect(starterShowsFreeTrial(plan("starter"))).toBe(false);
  });

  it("shows investor pricing and card features", () => {
    expect(planPriceHeadline(plan("investor"))).toBe("R299/month");
    expect(planBestFor(plan("investor"))).toContain("owner-managers");
    expect(planCardFeatureLines(plan("investor"))).toContain("Up to 10 properties");
    expect(planCardFeatureLines(plan("investor"))).toContain("10 investment reports");
  });

  it("shows portfolio pricing and unlimited reports", () => {
    expect(planPriceHeadline(plan("portfolio"))).toContain("R599/month");
    expect(planCardFeatureLines(plan("portfolio"))).toContain("Up to 30 properties");
    expect(planCardFeatureLines(plan("portfolio"))).toContain("Unlimited investment reports");
    expect(planReportLimitLabel(plan("portfolio"))).toBe("Unlimited reports");
  });

  it("shows portfolio pro pricing with contact subline", () => {
    expect(planPriceHeadline(plan("portfolio_pro"))).toBe("R999/month");
    expect(planPriceSubline(plan("portfolio_pro"))).toContain("contact");
    expect(planCardFeatureLines(plan("portfolio_pro"))).toContain("Up to 75 properties");
  });

  it("routes plan CTAs to signup or contact", () => {
    expect(planCta(plan("starter"))).toMatchObject({
      href: "/signup?plan=starter",
      label: "Join Free"
    });
    expect(planCta(plan("investor"))).toMatchObject({
      href: "/signup?plan=investor",
      label: "Choose Investor"
    });
    expect(planCta(plan("portfolio"))).toMatchObject({
      href: "/signup?plan=portfolio",
      label: "Choose Portfolio"
    });
    expect(planCta(plan("portfolio_pro"))).toMatchObject({
      href: "/contact",
      label: "Contact Sales"
    });
    expect(planSecondaryCta(plan("portfolio_pro"))).toEqual({
      label: "Request Quote",
      href: "/contact"
    });
  });
});
