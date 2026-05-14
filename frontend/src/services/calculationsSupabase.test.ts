import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deleteCalculationResult,
  listCalculationResults,
  runCalculatorLocally,
  saveCalculationResult
} from "./calculationsSupabase";

const rpc = vi.fn();
const from = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    rpc,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
    },
    from
  })
}));

describe("calculationsSupabase", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
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
                      created_at: "2026-01-02T00:00:00Z"
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

    const rows = await listCalculationResults();
    expect(rows).toHaveLength(1);
    expect(rows[0].hasPdf).toBe(true);
    expect(rows[0].downloadUrl).toContain("/api/reports/");
  });

  it("deleteCalculationResult deletes by id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({
      delete: vi.fn(() => ({ eq }))
    });
    await deleteCalculationResult("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(from).toHaveBeenCalledWith("calculator_results");
    expect(eq).toHaveBeenCalledWith("id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });
});
