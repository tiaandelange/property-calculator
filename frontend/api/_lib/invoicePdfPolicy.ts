/** Invoice PDFs are stored in Supabase Storage only after send/finalisation. */

const PDF_PERSIST_STATUSES = new Set(["SENT", "DUE", "OVERDUE", "PARTIALLY_PAID", "PAID"]);

export function shouldPersistInvoicePdf(status: unknown): boolean {
  return PDF_PERSIST_STATUSES.has(String(status ?? "").toUpperCase());
}

export function invoicePdfStorageKey(userId: string, invoiceId: string): string {
  return `${userId}/invoices/${invoiceId}.pdf`;
}

export function invoiceHasStoredPdf(
  invoice: { pdf_storage_bucket?: string | null; pdf_storage_key?: string | null },
  bucket = "invoices"
): boolean {
  return (
    invoice.pdf_storage_bucket === bucket &&
    invoice.pdf_storage_key != null &&
    String(invoice.pdf_storage_key).trim() !== ""
  );
}
