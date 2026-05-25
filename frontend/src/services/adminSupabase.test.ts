import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAdminStatus,
  getPortfolioProjectionMetrics,
  isCurrentUserAdmin,
  updatePortfolioProjectionMetrics
} from "./adminSupabase";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    auth: { getUser },
    from
  })
}));

describe("adminSupabase", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
  });

  function mockProfileRole(role: string | null) {
    from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null })
            }))
          }))
        };
      }
      return {};
    });
  }

  it("isCurrentUserAdmin is false for USER role", async () => {
    mockProfileRole("USER");
    await expect(isCurrentUserAdmin()).resolves.toBe(false);
  });

  it("getAdminStatus rejects non-admin", async () => {
    mockProfileRole("USER");
    await expect(getAdminStatus()).rejects.toThrow(/Forbidden: admin access required/i);
  });

  it("getAdminStatus succeeds for ADMIN", async () => {
    mockProfileRole("ADMIN");
    await expect(getAdminStatus()).resolves.toEqual({ message: "Admin access granted" });
  });

  it("getPortfolioProjectionMetrics maps defaults row", async () => {
    from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: "ADMIN" }, error: null })
            }))
          }))
        };
      }
      if (table === "portfolio_projection_defaults") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "def-1",
                    rental_income_growth_percent_annual: 7,
                    total_expenses_growth_percent_annual: 5
                  },
                  error: null
                })
              }))
            }))
          }))
        };
      }
      return {};
    });

    const res = await getPortfolioProjectionMetrics();
    expect(res.metrics).toEqual({
      rentalIncomeGrowthPercentAnnual: 7,
      totalExpensesGrowthPercentAnnual: 5
    });
    expect(res.description).toContain("portfolio IRR");
  });

  it("updatePortfolioProjectionMetrics clamps and updates singleton row", async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "def-1",
              rental_income_growth_percent_annual: 50,
              total_expenses_growth_percent_annual: -50
            },
            error: null
          })
        }))
      }))
    }));

    from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: "ADMIN" }, error: null })
            }))
          }))
        };
      }
      if (table === "portfolio_projection_defaults") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "def-1",
                    rental_income_growth_percent_annual: 6,
                    total_expenses_growth_percent_annual: 6
                  },
                  error: null
                })
              }))
            }))
          })),
          update
        };
      }
      return {};
    });

    const res = await updatePortfolioProjectionMetrics({
      rentalIncomeGrowthPercentAnnual: 99,
      totalExpensesGrowthPercentAnnual: -99
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        rental_income_growth_percent_annual: 50,
        total_expenses_growth_percent_annual: -50
      })
    );
    expect(res.metrics.rentalIncomeGrowthPercentAnnual).toBe(50);
    expect(res.metrics.totalExpensesGrowthPercentAnnual).toBe(-50);
  });

  it("updatePortfolioProjectionMetrics surfaces RLS denial as forbidden", async () => {
    from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: "ADMIN" }, error: null })
            }))
          }))
        };
      }
      if (table === "portfolio_projection_defaults") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "def-1",
                    rental_income_growth_percent_annual: 6,
                    total_expenses_growth_percent_annual: 6
                  },
                  error: null
                })
              }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "permission denied", code: "42501", hint: "", details: "" }
                })
              }))
            }))
          }))
        };
      }
      return {};
    });

    await expect(
      updatePortfolioProjectionMetrics({ rentalIncomeGrowthPercentAnnual: 8 })
    ).rejects.toThrow(/Forbidden: admin access required/i);
  });
});
