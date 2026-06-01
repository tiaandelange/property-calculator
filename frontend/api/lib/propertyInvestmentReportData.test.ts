import { describe, expect, it } from "vitest";
import { assemblePropertyInvestmentReportData } from "./propertyInvestmentReportData";

describe("assemblePropertyInvestmentReportData", () => {
  it("includes partial invoice payments in actuals", () => {
    const model = assemblePropertyInvestmentReportData({
      propertyRow: { name: "Test", purchase_price: 1_000_000, current_estimated_value: 1_000_000 },
      statement: { summary: {}, recurringCharges: [], bondFinance: {} },
      leases: [],
      invoices: [
        {
          status: "PARTIALLY_PAID",
          total: 10_000,
          invoice_payments: [{ amount: 4_000 }]
        }
      ]
    });
    const paymentsLine = model.actuals.find((a) => a.label === "Total payments received");
    expect(paymentsLine?.value).toContain("4");
  });
});
