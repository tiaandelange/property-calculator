import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildFinancialSummaryFromLedger,
  listIncome,
  markIncomeReceived
} from "./financialsSupabase";

const getUser = vi.fn();
const from = vi.fn();
const rpc = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    auth: { getUser },
    from,
    rpc
  })
}));

vi.mock("./propertiesSupabase", () => ({
  getProperty: vi.fn()
}));

describe("financialsSupabase", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
    rpc.mockReset();
  });

  it("buildFinancialSummaryFromLedger matches monthly rent + expense slice (UTC month)", () => {
    const property = {
      purchasePrice: 1_000_000,
      monthlyBondPayment: 5000,
      outstandingBondBalance: 400_000,
      currentEstimatedValue: 1_200_000,
      leases: [
        {
          status: "ACTIVE",
          fixedTermEndDate: new Date(Date.now() + 86400000).toISOString()
        }
      ]
    };
    const month = "2026-03";
    const { start } = (() => {
      const y = 2026;
      const mo = 2;
      return { start: new Date(Date.UTC(y, mo, 1)) };
    })();
    const inMonth = start.toISOString().slice(0, 10);
    const income = [
      { status: "RECEIVED", category: "RENT", amount: 8000, incomeDate: `${inMonth}T12:00:00.000Z` },
      { status: "EXPECTED", category: "RENT", amount: 1000, incomeDate: `${inMonth}T12:00:00.000Z` }
    ];
    const expenses = [
      { status: "ACTIVE", category: "WATER", amount: 200, expenseDate: `${inMonth}T12:00:00.000Z` }
    ];
    const s = buildFinancialSummaryFromLedger(property, income, expenses, month) as {
      monthly: Record<string, number>;
      investorMetrics: { occupancyStatus: string };
    };
    expect(s).not.toBeNull();
    expect(s.monthly.totalIncome).toBe(8000);
    expect(s.monthly.expectedIncome).toBe(1000);
    expect(s.monthly.totalExpenses).toBe(200 + 5000);
    expect(s.monthly.totalBondPayment).toBe(5000);
    expect(s.investorMetrics.occupancyStatus).toBe("Occupied");
  });

  it("listIncome throws when logged out", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listIncome("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")).rejects.toThrow(/Not signed in/i);
  });

  it("listIncome returns empty array when query returns no rows (RLS / wrong property)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "11111111-1111-1111-1111-111111111111" } }, error: null });
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          neq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }))
    });
    const rows = await listIncome("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(from).toHaveBeenCalledWith("income_entries");
    expect(rows).toEqual([]);
  });

  it("markIncomeReceived throws when row is not EXPECTED", async () => {
    const uid = "11111111-1111-1111-1111-111111111111";
    getUser.mockResolvedValue({ data: { user: { id: uid } }, error: null });
    from.mockImplementation((table: string) => {
      if (table !== "income_entries") return {};
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: { id: "inc-1", status: "RECEIVED" },
                  error: null
                })
              )
            }))
          }))
        }))
      };
    });
    await expect(markIncomeReceived("inc-1", { paymentDate: "2026-05-01" })).rejects.toThrow(/EXPECTED/i);
  });
});
