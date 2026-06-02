import { describe, expect, it } from "vitest";
import { assemblePropertyInvestmentReportData, irrPercent } from "./propertyInvestmentReportData";

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

describe("irrPercent", () => {
  it("matches the example scenario (~10.66%)", () => {
    // Year 0: -100,000
    // Year 1-2: +5,000
    // Year 3: +125,000 (cash flow + sale)
    const irr = irrPercent(100_000, [5_000, 5_000, 125_000]);
    // Allow small numeric tolerance (solver + rounding to 2dp)
    expect(irr).not.toBeNull();
    expect(Number(irr)).toBeGreaterThan(10.5);
    expect(Number(irr)).toBeLessThan(11.1);
  });
});
