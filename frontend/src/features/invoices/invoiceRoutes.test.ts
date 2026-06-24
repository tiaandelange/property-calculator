import { describe, expect, it } from "vitest";
import { invoiceCreatePath, invoiceDetailPath, tenantInvoiceEditorPath } from "./invoiceRoutes";

const SAMPLE_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("invoiceRoutes", () => {
  it("uses canonical /invoices/:id path", () => {
    expect(invoiceDetailPath(SAMPLE_UUID)).toBe(`/invoices/${SAMPLE_UUID}`);
    expect(tenantInvoiceEditorPath("tenant-1", SAMPLE_UUID, "prop-1")).toBe(`/invoices/${SAMPLE_UUID}`);
    expect(invoiceDetailPath("INV-26-0005")).toBe("");
  });

  it("builds create path with query params", () => {
    expect(invoiceCreatePath({ tenantId: "t1", propertyId: "p1" })).toBe("/invoices/new?tenantId=t1&propertyId=p1");
  });
});
