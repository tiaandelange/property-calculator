import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardSummary, supabaseDashboardPropertyId } from "./dashboardSupabase";

const rpc = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    rpc
  })
}));

describe("dashboardSupabase", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("supabaseDashboardPropertyId accepts UUID and rejects numeric string", () => {
    expect(supabaseDashboardPropertyId("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(supabaseDashboardPropertyId(42)).toBeNull();
    expect(supabaseDashboardPropertyId("123")).toBeNull();
  });

  it("getDashboardSummary calls RPC with snake_case params and timezone", async () => {
    rpc.mockResolvedValue({ data: { totalProperties: 0, kpis: {} }, error: null });
    const out = await getDashboardSummary({
      month: "2026-03",
      propertyTypes: ["LONG_TERM_RENTAL"],
      propertyId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      portfolioIrrHorizonYears: 12
    });
    expect(rpc).toHaveBeenCalledWith(
      "get_dashboard_summary",
      expect.objectContaining({
        p_month: "2026-03",
        p_property_types: ["LONG_TERM_RENTAL"],
        p_property_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        p_portfolio_irr_horizon_years: 12,
        p_iana_timezone: expect.any(String)
      })
    );
    expect(out).toEqual({ totalProperties: 0, kpis: {} });
  });

  it("getDashboardSummary throws on RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "nope", hint: "", details: "" } });
    await expect(getDashboardSummary()).rejects.toThrow(/nope/);
  });
});
