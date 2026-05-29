import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildInvoicePdfDefinition } from "../lib/invoicePdfBuilder.js";
import { renderPdfDefinitionToBuffer } from "../lib/pdfMakeServer.js";

/** Smoke test: invoice PDF fonts + pdfmake (no Supabase). Protect in production via CRON_SECRET. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).setHeader("Allow", "GET, POST, OPTIONS").json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (process.env.VERCEL_ENV === "production" && secret) {
    const provided = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
    if (provided !== secret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  try {
    const definition = buildInvoicePdfDefinition({
      invoiceId: "00000000-0000-0000-0000-000000000001",
      invoiceNumber: "INV-SMOKE",
      invoiceDate: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      status: "DRAFT",
      subtotal: 100,
      total: 100,
      balanceDue: 100,
      notes: null,
      tenantLines: ["Smoke Test Tenant"],
      propertyLines: ["Smoke Property"],
      unitLabel: null,
      leaseLabel: null,
      paymentReference: "INV-SMOKE",
      lineItems: [{ description: "Rent", quantity: 1, unitPrice: 100, total: 100 }],
      ledgerRows: [],
      totalDueOutstanding: 100,
      paymentDetailLines: ["Bank: Smoke Test"],
      isDraftPreview: true
    });

    const buf = await renderPdfDefinitionToBuffer(definition);
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="invoice-pdf-smoke-test.pdf"');
    res.send(buf);
  } catch (e: unknown) {
    console.error("[invoices/pdf-smoke-test] failed", e);
    res.status(500).json({
      ok: false,
      error: "INVOICE_PDF_SMOKE_TEST_FAILED",
      message: e instanceof Error ? e.message : "Smoke test failed."
    });
  }
}
