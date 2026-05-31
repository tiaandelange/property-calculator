import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../../services/subscriptionPlansSupabase";
import {
  buildPricingComparisonRows,
  orderPlansForComparison,
  PRICING_PLAN_CODES
} from "./pricingComparisonMatrix";

describe("pricingComparisonMatrix QA", () => {
  it("orders all four tiers for comparison", () => {
    const ordered = orderPlansForComparison(FALLBACK_SUBSCRIPTION_PLANS);
    expect(ordered.map((p) => p.code)).toEqual([...PRICING_PLAN_CODES]);
  });

  it("builds 20 feature rows plus dynamic values", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    expect(rows).toHaveLength(20);
    expect(rows.map((r) => r.id)).toContain("monthly_price");
    expect(rows.map((r) => r.id)).toContain("future_team_access");
  });

  it("uses check and cross marks for boolean features", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    const calculators = rows.find((r) => r.id === "investment_calculators");
    expect(calculators?.values.starter).toEqual({ kind: "no" });
    expect(calculators?.values.investor).toEqual({ kind: "yes" });
  });

  it("shows starter trial as included", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    const trial = rows.find((r) => r.id === "free_trial");
    expect(trial?.values.starter).toEqual({ kind: "yes" });
    expect(trial?.values.investor).toEqual({ kind: "no" });
  });
});
