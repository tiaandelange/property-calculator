import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../../services/subscriptionPlansSupabase";
import {
  planApplicationLinksLimitLabel,
  subscriptionDashboardFeatureRows
} from "./subscriptionDashboardFeatures";

describe("subscriptionDashboardFeatureRows", () => {
  it("starter plan locks premium features", () => {
    const starter = FALLBACK_SUBSCRIPTION_PLANS.find((p) => p.code === "starter")!;
    const rows = subscriptionDashboardFeatureRows(starter);
    expect(rows.find((r) => r.key === "irr")?.enabled).toBe(false);
    expect(rows.find((r) => r.key === "graphs")?.enabled).toBe(false);
    expect(rows.find((r) => r.key === "fullAnalytics")?.enabled).toBe(false);
  });

  it("investor plan enables IRR and graphs", () => {
    const investor = FALLBACK_SUBSCRIPTION_PLANS.find((p) => p.code === "investor")!;
    const rows = subscriptionDashboardFeatureRows(investor);
    expect(rows.find((r) => r.key === "irr")?.enabled).toBe(true);
    expect(rows.find((r) => r.key === "graphs")?.enabled).toBe(true);
    expect(rows.find((r) => r.key === "unlimitedReports")?.enabled).toBe(false);
  });

  it("admin shows all features enabled", () => {
    const rows = subscriptionDashboardFeatureRows(null, { isAdmin: true });
    expect(rows.every((r) => r.enabled)).toBe(true);
  });
});

describe("planApplicationLinksLimitLabel", () => {
  it("describes starter cap", () => {
    const starter = FALLBACK_SUBSCRIPTION_PLANS.find((p) => p.code === "starter")!;
    expect(planApplicationLinksLimitLabel(starter)).toMatch(/1 active link/);
  });
});
