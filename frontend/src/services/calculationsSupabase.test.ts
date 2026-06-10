import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deleteCalculationResult,
  listCalculationResults,
  runCalculatorLocally,
  saveCalculationResult
} from "./calculationsSupabase";

const rpc = vi.fn();
const from = vi.fn();
const storageFrom = vi.fn();
const getSession = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    rpc,
    auth: { getSession },
    from,
    storage: { from: storageFrom }
  })
}));

describe("calculationsSupabase", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    storageFrom.mockReset();
    getSession.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
      error: null
    });
  });

  it("runCalculatorLocally runs transfer-bond-costs for valid payload", () => {
    const r = runCalculatorLocally("transfer-bond-costs", {
      purchasePrice: 1_000_000,
      bondAmount: 800_000,
      buyerType: "INDIVIDUAL",
      transactionType: "TRANSFER_DUTY"
    });
    expect(r.calculator).toBe("transfer-bond-costs");
    expect(Array.isArray(r.summary)).toBe(true);
  });

  it("runCalculatorLocally irr growth mode applies a single exit selling cost percent", () => {
    const base = {
      holdPeriodYears: 5,
      totalCashInvested: 210_000,
      currentEstimatedValue: 2_300_000,
      annualCashFlowAfterExpensesAndDebt: 12_000,
      outstandingBondBalance: 1_840_000,
      outstandingBondInterestRatePercent: 10.5,
      bondTermYears: 20,
      expectedAnnualAppreciationPercent: 0,
      estimatedSellingCostPercent: 10,
      sellingCostsPercent: 5
    };
    const atTen = runCalculatorLocally("irr", base);
    const futureValue = 2_300_000;
    expect(atTen.breakdown?.futurePropertyValue).toBe(futureValue);
    expect(atTen.breakdown?.sellingCosts).toBe(230_000);
    const propertyValueCard = atTen.summary?.find((m) => m.key === "propertyValueAfterSale");
    expect(propertyValueCard?.value).toBe(futureValue);
    expect(atTen.breakdown?.bondBasis).toBe("amortized");
    expect(Number(atTen.breakdown?.bondBalanceAtSale)).toBeLessThan(1_840_000);

    const atFive = runCalculatorLocally("irr", { ...base, estimatedSellingCostPercent: 5 });
    expect(atFive.breakdown?.sellingCosts).toBe(115_000);

    const comboChart = atTen.chartData?.[0];
    expect(comboChart?.chartType).toBe("combo");
    expect(comboChart?.data?.datasets).toHaveLength(2);
    const irrByYear = atTen.breakdown?.irrByYear as Array<{ year: number; irr: number | null }>;
    expect(irrByYear?.length).toBe(5);
    expect(irrByYear?.[4]?.irr).toBe(atTen.summary?.find((m) => m.key === "irrPercent")?.value);
  });

  it("runCalculatorLocally runs buy-vs-rent with charts and interpretation", () => {
    const r = runCalculatorLocally("buy-vs-rent", {
      purchasePrice: 1_500_000,
      monthlyRent: 12_000,
      depositAmount: 150_000,
      interestRate: 11.75,
      analysisYears: 10,
      propertyAppreciation: 5,
      rentEscalation: 6
    });
    expect(r.calculator).toBe("buy-vs-rent");
    expect(r.summary?.length).toBe(5);
    expect(r.chartData?.length).toBe(3);
    expect(r.interpretation?.text).toMatch(/buying|renting|close/i);
    expect(["buy", "rent", "close"]).toContain(r.breakdown?.verdict);
    expect(Number(r.breakdown?.bondAmount)).toBe(1_350_000);
    expect(r.breakdown?.simple).toBeTruthy();
  });

  it("saveCalculationResult calls save_calculation_and_decrement_free_use RPC", async () => {
    const result = runCalculatorLocally("monthly-payment", {
      bondAmount: 1_000_000,
      annualInterestRate: 12,
      loanTermYears: 20
    });
    rpc.mockResolvedValue({
      data: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        type: "monthly-payment",
        input: { bondAmount: 1_000_000, annualInterestRate: 12, loanTermYears: 20 },
        result,
        freeUsesRemaining: 2
      },
      error: null
    });
    const out = await saveCalculationResult(
      "monthly-payment",
      { bondAmount: 1_000_000, annualInterestRate: 12, loanTermYears: 20 },
      result
    );
    expect(rpc).toHaveBeenCalledWith(
      "save_calculation_and_decrement_free_use",
      expect.objectContaining({
        p_type: "monthly-payment",
        p_input: { bondAmount: 1_000_000, annualInterestRate: 12, loanTermYears: 20 },
        p_result: result
      })
    );
    expect(out.id).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(out.freeUsesRemaining).toBe(2);
  });

  it("listCalculationResults merges latest stored_reports row", async () => {
    from.mockImplementation((table: string) => {
      if (table === "calculator_results") {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  type: "noi",
                  created_at: "2026-01-01T00:00:00Z",
                  input_json: { a: 1 },
                  result_json: { calculator: "noi", summary: [] }
                }
              ],
              error: null
            })
          }))
        };
      }
      if (table === "stored_reports") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                      calculation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                      file_name: "calc.pdf",
                      created_at: "2026-01-02T00:00:00Z",
                      storage_bucket: "reports",
                      storage_key: "u1/reports/bbbb.pdf"
                    }
                  ],
                  error: null
                })
              }))
            }))
          }))
        };
      }
      return {};
    });

    storageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/calc.pdf" },
        error: null
      })
    });

    const rows = await listCalculationResults();
    expect(rows).toHaveLength(1);
    expect(rows[0].hasPdf).toBe(true);
    expect(rows[0].downloadUrl).toContain("signed.example");
  });

  it("deleteCalculationResult deletes stored_reports then calculator_results", async () => {
    const eqChain = () => ({
      eq: vi.fn().mockResolvedValue({ data: [], error: null })
    });
    const delChain = () => ({
      eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    });

    from.mockImplementation((table: string) => {
      if (table === "stored_reports") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => eqChain()) })),
          delete: vi.fn(() => delChain())
        };
      }
      if (table === "calculator_results") {
        return { delete: vi.fn(() => delChain()) };
      }
      return {};
    });
    await deleteCalculationResult("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(from).toHaveBeenCalledWith("stored_reports");
    expect(from).toHaveBeenCalledWith("calculator_results");
  });
});
