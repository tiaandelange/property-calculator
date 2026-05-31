import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../../services/subscriptionPlansSupabase";
import {
  planCta,
  planFeatureBullets,
  planPriceHeadline,
  planReportLimitLabel,
  planSecondaryCta
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

  it("shows starter as free with monthly report limit", () => {
    expect(planPriceHeadline(plan("starter"))).toBe("Free");
    expect(planReportLimitLabel(plan("starter"))).toBe("3 investment reports per month");
    expect(plan("starter").monthlyPrice).toBe(0);
  });

  it("shows investor pricing and feature bullets", () => {
    expect(planPriceHeadline(plan("investor"))).toBe("R299/month");
    expect(planFeatureBullets(plan("investor"))).toEqual([
      "Up to 10 properties",
      "10 investment reports per month",
      "Calculators + management software"
    ]);
  });

  it("shows portfolio pricing and unlimited reports", () => {
    expect(planPriceHeadline(plan("portfolio"))).toContain("R599/month");
    expect(planFeatureBullets(plan("portfolio"))).toContain("Up to 30 properties");
    expect(planFeatureBullets(plan("portfolio"))).toContain("Unlimited reports");
  });

  it("shows portfolio pro pricing with contact option", () => {
    expect(planPriceHeadline(plan("portfolio_pro"))).toBe("R999/month · or contact us");
    expect(planFeatureBullets(plan("portfolio_pro"))).toContain("Up to 75 properties");
  });

  it("routes signup CTAs with plan query params", () => {
    expect(planCta(plan("starter"))).toMatchObject({
      href: "/signup?plan=starter",
      label: "Get started free"
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
      href: "/contact",
      label: "Contact us"
    });
    expect(planSecondaryCta(plan("portfolio_pro"))).toEqual({
      label: "Subscribe online",
      href: "/signup?plan=portfolio_pro"
    });
  });
});
