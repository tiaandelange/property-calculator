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

  it("shows starter as FREE with trial subline", () => {
    expect(planPriceHeadline(plan("starter"))).toBe("FREE");
    expect(planPriceSubline(plan("starter"))).toContain("14-day free trial");
    expect(planPriceSubline(plan("starter"))).toContain("R99/month");
    expect(starterShowsFreeTrial(plan("starter"))).toBe(true);
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

  it("routes signup CTAs with plan query params", () => {
    expect(planCta(plan("starter"))).toMatchObject({
      href: "/signup?plan=starter",
      label: "Sign Up"
    });
    expect(planCta(plan("investor"))).toMatchObject({
      href: "/signup?plan=investor",
      label: "Subscribe"
    });
    expect(planCta(plan("portfolio"))).toMatchObject({
      href: "/signup?plan=portfolio",
      label: "Subscribe"
    });
    expect(planCta(plan("portfolio_pro"))).toMatchObject({
      href: "/signup?plan=portfolio_pro",
      label: "Subscribe"
    });
    expect(planSecondaryCta(plan("portfolio_pro"))).toEqual({
      label: "Contact us",
      href: "/contact"
    });
  });
});
