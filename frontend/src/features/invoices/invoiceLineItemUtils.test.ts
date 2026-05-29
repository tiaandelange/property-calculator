import { describe, expect, it } from "vitest";
import {
  calcInvoiceSubtotal,
  categoryOptionValue,
  emptyInvoiceLine,
  invoiceLineItemsForSave,
  lineItemAmount,
  moveLineItem,
  patchInvoiceLineItem
} from "./invoiceLineItemUtils";

describe("invoiceLineItemUtils", () => {
  it("calculates line amount from quantity and unit price", () => {
    expect(lineItemAmount(2, 50.5)).toBe(101);
    expect(lineItemAmount(1, 100)).toBe(100);
  });

  it("sums subtotal across line items", () => {
    const items = [emptyInvoiceLine(1000), { ...emptyInvoiceLine(200), description: "Water", category: "UTILITIES_RECOVERY" }];
    expect(calcInvoiceSubtotal(items)).toBe(1200);
  });

  it("patches line item and recalculates total", () => {
    const row = emptyInvoiceLine(100);
    const next = patchInvoiceLineItem(row, { quantity: 2 });
    expect(next.total).toBe(200);
  });

  it("maps utility recovery category from description", () => {
    expect(categoryOptionValue("UTILITIES_RECOVERY", "Waste Recovery")).toBe("UTILITIES_RECOVERY:WASTE");
    expect(categoryOptionValue("UTILITIES_RECOVERY", "Electricity Recovery")).toBe("UTILITIES_RECOVERY:ELECTRICITY");
    expect(categoryOptionValue("RENT", "Monthly Rent")).toBe("RENT");
  });

  it("reorders line items and reindexes sort order", () => {
    const a = { ...emptyInvoiceLine(100), description: "A", sortOrder: 1 };
    const b = { ...emptyInvoiceLine(50), description: "B", sortOrder: 2 };
    const moved = moveLineItem([a, b], 1, 0);
    expect(moved[0].description).toBe("B");
    expect(moved[0].sortOrder).toBe(1);
    expect(moved[1].sortOrder).toBe(2);
  });

  it("builds RPC payload with category and sort order", () => {
    const payload = invoiceLineItemsForSave([
      { description: "Water Recovery", category: "UTILITIES_RECOVERY", quantity: 1, unitPrice: 250, total: 250, sortOrder: 1 }
    ]);
    expect(payload[0]).toMatchObject({
      description: "Water Recovery",
      category: "UTILITIES_RECOVERY",
      quantity: 1,
      unitPrice: 250,
      total: 250,
      sortOrder: 1
    });
  });
});
