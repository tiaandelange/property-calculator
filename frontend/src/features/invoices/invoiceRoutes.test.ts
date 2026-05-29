import { describe, expect, it } from "vitest";
import { invoiceCreatePath, invoiceDetailPath, tenantInvoiceEditorPath } from "./invoiceRoutes";

describe("invoiceRoutes", () => {
  it("uses canonical /invoices/:id path", () => {
    expect(invoiceDetailPath("abc-123")).toBe("/invoices/abc-123");
    expect(tenantInvoiceEditorPath("tenant-1", "abc-123", "prop-1")).toBe("/invoices/abc-123");
  });

  it("builds create path with query params", () => {
    expect(invoiceCreatePath({ tenantId: "t1", propertyId: "p1" })).toBe("/invoices/new?tenantId=t1&propertyId=p1");
  });
});
