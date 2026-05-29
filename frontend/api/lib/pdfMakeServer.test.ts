import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildInvoicePdfDefinition } from "./invoicePdfBuilder";
import { renderPdfDefinitionToBuffer, resolveLocalPdfFonts } from "./pdfMakeServer";

describe("pdfMakeServer", () => {
  it("finds committed Roboto fonts under frontend/assets/fonts/pdfmake", () => {
    const fonts = resolveLocalPdfFonts();
    for (const p of [fonts.normal, fonts.bold, fonts.italics, fonts.bolditalics]) {
      expect(existsSync(p!)).toBe(true);
      expect(p).toMatch(/assets\/fonts\/pdfmake\/Roboto-/);
    }
  });

  it("renders a minimal invoice-like PDF buffer using Roboto", async () => {
    const definition = buildInvoicePdfDefinition({
      invoiceId: "11111111-1111-1111-1111-111111111111",
      invoiceNumber: "INV-SMOKE",
      invoiceDate: "2026-05-01T12:00:00.000Z",
      dueDate: "2026-05-15T12:00:00.000Z",
      status: "DRAFT",
      subtotal: 1000,
      total: 1000,
      balanceDue: 1000,
      notes: null,
      tenantLines: ["Smoke Test Tenant"],
      propertyLines: ["Smoke Property"],
      unitLabel: null,
      leaseLabel: null,
      paymentReference: "INV-SMOKE",
      lineItems: [{ description: "Rent", quantity: 1, unitPrice: 1000, total: 1000 }],
      ledgerRows: [],
      totalDueOutstanding: 1000,
      paymentDetailLines: ["Bank: Test"],
      isDraftPreview: true
    });

    const buf = await renderPdfDefinitionToBuffer(definition);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});

describe("pdfMakeServer font files on disk", () => {
  it("Roboto files exist at frontend/assets/fonts/pdfmake", () => {
    const base = join(process.cwd(), "assets/fonts/pdfmake");
    for (const name of [
      "Roboto-Regular.ttf",
      "Roboto-Medium.ttf",
      "Roboto-Italic.ttf",
      "Roboto-MediumItalic.ttf"
    ]) {
      expect(existsSync(join(base, name)), `missing ${name}`).toBe(true);
    }
  });
});
