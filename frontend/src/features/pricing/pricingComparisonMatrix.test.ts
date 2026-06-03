import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../../services/subscriptionPlansSupabase";
import {
  buildPricingComparisonRows,
  orderPlansForComparison,
  PRICING_PLAN_CODES
} from "./pricingComparisonMatrix";

describe("pricingComparisonMatrix", () => {
  it("orders all four tiers for comparison", () => {
    const ordered = orderPlansForComparison(FALLBACK_SUBSCRIPTION_PLANS);
    expect(ordered.map((p) => p.code)).toEqual([...PRICING_PLAN_CODES]);
  });

  it("exposes the 17 marketing comparison rows", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    expect(rows).toHaveLength(17);
    expect(rows.map((r) => r.id)).toEqual([
      "monthly_price",
      "property_limit",
      "reports_per_month",
      "basic_property_management",
      "tenants_leases_invoices",
      "basic_calculators",
      "full_analytics_dashboard",
      "irr_calculations",
      "graphs_and_charts",
      "forecasting",
      "property_comparison",
      "portfolio_dashboard",
      "advanced_reports",
      "tenant_application_links",
      "report_branding",
      "team_access",
      "priority_support"
    ]);
  });

  it("shows Starter as Free with locked analytics", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    const price = rows.find((r) => r.id === "monthly_price");
    expect(price?.values.starter).toEqual({ kind: "text", text: "Free" });
    expect(rows.find((r) => r.id === "free_trial")).toBeUndefined();

    const irr = rows.find((r) => r.id === "irr_calculations");
    expect(irr?.values.starter).toEqual({ kind: "no" });
    expect(irr?.values.investor).toEqual({ kind: "yes" });
  });

  it("differentiates Investor advanced reports as Limited", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    const advanced = rows.find((r) => r.id === "advanced_reports");
    expect(advanced?.values.starter).toEqual({ kind: "no" });
    expect(advanced?.values.investor).toEqual({ kind: "text", text: "Limited" });
    expect(advanced?.values.portfolio).toEqual({ kind: "yes" });
  });

  it("shows Portfolio Pro report branding and team access", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    expect(rows.find((r) => r.id === "report_branding")?.values.portfolio_pro).toEqual({ kind: "yes" });
    expect(rows.find((r) => r.id === "team_access")?.values.portfolio_pro).toEqual({
      kind: "text",
      text: "Included"
    });
  });

  it("shows priority support by tier", () => {
    const rows = buildPricingComparisonRows(FALLBACK_SUBSCRIPTION_PLANS);
    const support = rows.find((r) => r.id === "priority_support");
    expect(support?.values.starter).toEqual({ kind: "text", text: "Standard" });
    expect(support?.values.portfolio).toEqual({ kind: "text", text: "Priority" });
  });
});
