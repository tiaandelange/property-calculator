import { describe, it, expect } from "vitest";
import { buildTenantPaymentLineItems } from "./tenantStatementAdapter";

describe("buildTenantPaymentLineItems", () => {
  it("includes payments from PARTIALLY_PAID invoices", () => {
    const items = buildTenantPaymentLineItems([
      {
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "PARTIALLY_PAID",
        payments: [
          {
            id: "pay-1",
            invoice_id: "inv-1",
            payment_date: "2026-06-01",
            payment_reference: "EFT123",
            amount: 500
          }
        ]
      }
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(500);
    expect(items[0].invoiceNumber).toBe("INV-001");
    expect(items[0].paymentReference).toBe("EFT123");
  });

  it("flattens multiple payments across invoices", () => {
    const items = buildTenantPaymentLineItems([
      {
        id: "inv-1",
        invoiceNumber: "A",
        payments: [{ id: "p1", payment_date: "2026-06-02", amount: 100 }]
      },
      {
        id: "inv-2",
        invoiceNumber: "B",
        payments: [{ id: "p2", payment_date: "2026-06-01", amount: 200 }]
      }
    ]);
    expect(items.map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});
