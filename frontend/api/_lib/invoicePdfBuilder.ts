import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { paymentDetailsLinesForInvoice } from "./invoicePaymentDetailsShared.js";
import { mapToInvoicePdfDocument, type InvoicePdfBuildContext } from "./pdf/invoicePdfDataMapper.js";
import { buildInvoicePdfDocumentDefinition } from "./pdf/invoicePdfTemplate.js";
import { buildGlobalPdfTheme } from "./pdf/globalPdfTheme.js";

export type {
  InvoicePdfLineItem,
  InvoicePdfPayment,
  InvoicePdfLedgerRow,
  InvoicePdfData
} from "./pdf/invoicePdfLegacyTypes.js";

export { type InvoicePdfBuildContext } from "./pdf/invoicePdfDataMapper.js";

export function paymentDetailsLines(raw: unknown, leaseReference?: string | null): string[] {
  return paymentDetailsLinesForInvoice(raw, leaseReference);
}

export function threeMonthBoundsFromInvoiceDate(invoiceDateIso: string, from = new Date()) {
  const inv = new Date(invoiceDateIso);
  const anchor = Number.isNaN(inv.getTime()) ? from : inv;
  const windowStart = new Date(anchor.getUTCFullYear(), anchor.getUTCMonth() - 2, 1);
  const windowEnd = new Date(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1);
  return { windowStart, windowEnd };
}

/**
 * Builds a tax-invoice PDF definition using the global Proplytic template.
 * Pass `context` from the server for branding, landlord details, and theme colours.
 */
export function buildInvoicePdfDefinition(
  data: import("./pdf/invoicePdfLegacyTypes.js").InvoicePdfData,
  context?: InvoicePdfBuildContext
): TDocumentDefinitions {
  const theme = context?.theme ?? buildGlobalPdfTheme();
  const ctx: InvoicePdfBuildContext = context ?? {
    theme,
    landlord: {
      name: "Proplytic",
      email: undefined
    },
    pdfBrandingEnabled: true
  };
  const document = mapToInvoicePdfDocument(data, ctx, ctx.paymentDetailsRaw);
  return buildInvoicePdfDocumentDefinition(document);
}

/** @deprecated Use buildInvoicePdfDefinition — kept for rollback comparison during template migration. */
export function buildLegacyInvoicePdfDefinition(
  data: import("./pdf/invoicePdfLegacyTypes.js").InvoicePdfData
): TDocumentDefinitions {
  return buildInvoicePdfDefinition(data);
}
