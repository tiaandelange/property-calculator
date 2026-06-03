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

  it("builds full feature comparison rows", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(rows.map((r) => r.id)).toContain("monthly_price");
    expect(rows.map((r) => r.id)).toContain("public_calculators");
    expect(rows.map((r) => r.id)).toContain("future_team_access");
  });

  it("uses check and cross marks for boolean features", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    const calculators = rows.find((r) => r.id === "property_type_calculators");
    expect(calculators?.values.starter).toEqual({ kind: "no" });
    expect(calculators?.values.investor).toEqual({ kind: "yes" });
  });

  it("shows free trial only on tiers with trial_days", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    const trial = rows.find((r) => r.id === "free_trial");
    expect(trial?.values.starter).toEqual({ kind: "no" });
    expect(trial?.values.portfolio).toEqual({ kind: "yes" });
  });

  it("shows starter report limit as 3 per month", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    const reports = rows.find((r) => r.id === "investment_report_limit");
    expect(reports?.values.starter).toEqual({ kind: "text", text: "3 per month" });
  });
});
