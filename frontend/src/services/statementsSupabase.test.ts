import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calendarMonthPartsForStatementRpc,
  getPropertyMonthlyStatement,
  supabaseStatementPropertyId
} from "./statementsSupabase";

const rpc = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    rpc
  })
}));

describe("statementsSupabase", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("supabaseStatementPropertyId accepts UUID and rejects legacy numeric id", () => {
    expect(supabaseStatementPropertyId("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    );
    expect(supabaseStatementPropertyId(42)).toBeNull();
    expect(supabaseStatementPropertyId("123")).toBeNull();
  });

  it("calendarMonthPartsForStatementRpc parses YYYY-MM as UTC month", () => {
    const fb = new Date(Date.UTC(2026, 4, 14, 12, 0, 0));
    expect(calendarMonthPartsForStatementRpc("2026-03", fb)).toEqual({ year: 2026, month: 3 });
  });

  it("calendarMonthPartsForStatementRpc falls back to UTC month of instant", () => {
    const fb = new Date(Date.UTC(2026, 0, 15, 0, 0, 0));
    expect(calendarMonthPartsForStatementRpc(null, fb)).toEqual({ year: 2026, month: 1 });
    expect(calendarMonthPartsForStatementRpc(undefined, fb)).toEqual({ year: 2026, month: 1 });
  });

  it("getPropertyMonthlyStatement calls RPC and normalizes currentInvoice", async () => {
    rpc.mockResolvedValue({
      data: {
        warnings: [],
        bondFinance: {},
        property: { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
        summary: {},
        statementRows: [],
        currentInvoice: {
          id: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          invoice_number: "INV-1",
          status: "DRAFT",
          total: 100,
          invoice_line_items: [],
          tenants: null
        },
        deposits: [],
        futureCharges: [],
        recurringCharges: []
      },
      error: null
    });
    const out = await getPropertyMonthlyStatement("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", {
      month: "2026-02",
      includeExpected: true
    });
    expect(rpc).toHaveBeenCalledWith(
      "get_property_monthly_statement",
      expect.objectContaining({
        p_property_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        p_year: 2026,
        p_month: 2,
        p_include_expected: true
      })
    );
    expect(out.currentInvoice).toMatchObject({
      invoiceNumber: "INV-1",
      lineItems: []
    });
  });

  it("getPropertyMonthlyStatement throws on RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Property not found", hint: "", details: "" } });
    await expect(
      getPropertyMonthlyStatement("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", { month: "2026-01" })
    ).rejects.toThrow(/Property not found/);
  });
});
