import { describe, expect, it } from "vitest";
import { buildInvoicePdfDefinition, paymentDetailsLines } from "./invoicePdfBuilder";

describe("invoicePdfBuilder", () => {
  it("paymentDetailsLines returns default when profile JSON missing", () => {
    const lines = paymentDetailsLines(null);
    expect(lines[0]).toMatch(/Account \/ profile/i);
  });

  it("buildInvoicePdfDefinition includes invoice number, tenant, and payments", () => {
    const def = buildInvoicePdfDefinition({
      invoiceId: "11111111-1111-1111-1111-111111111111",
      invoiceNumber: "INV-00042",
      invoiceDate: "2026-05-01T12:00:00.000Z",
      dueDate: "2026-05-15T12:00:00.000Z",
      status: "DRAFT",
      subtotal: 5000,
      total: 5000,
      balanceDue: 2000,
      notes: null,
      tenantLines: ["Jane Tenant", "jane@example.com"],
      propertyLines: ["Unit 4", "1 Main Rd, Cape Town"],
      unitLabel: "Unit 4",
      leaseLabel: "From 2026-01-01",
      paymentReference: "INV-00042",
      lineItems: [{ description: "Rent", quantity: 1, unitPrice: 5000, total: 5000 }],
      payments: [{ date: "2026-05-10", reference: "EFT", amount: 3000 }],
      paymentDetailLines: ["Bank: Test Bank"],
      isDraftPreview: true
    });
    const text = JSON.stringify(def.content);
    expect(text).toContain("INV-00042");
    expect(text).toContain("Jane Tenant");
    expect(text).toContain("Unit 4");
    expect(text).toContain("Payments received");
    expect(text).toContain("Balance due");
    expect(text).not.toMatch(/Recent ledger activity/i);
  });
});
