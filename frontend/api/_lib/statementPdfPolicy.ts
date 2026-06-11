const PDF_PERSIST_STATUSES = new Set(["SENT", "DUE", "OVERDUE", "PARTIALLY_PAID", "PAID"]);

export function shouldPersistStatementPdf(status: unknown): boolean {
  return PDF_PERSIST_STATUSES.has(String(status ?? "").toUpperCase());
}

/** Matches `invoices` bucket RLS: `{user_id}/invoices/...` */
export function statementPdfStorageKey(userId: string, statementId: string): string {
  return `${userId}/invoices/tenant-statements/${statementId}.pdf`;
}

export function statementPreviewPdfStorageKey(userId: string, statementId: string): string {
  return `${userId}/invoices/tenant-statements/preview/${statementId}.pdf`;
}

export function statementHasStoredPdf(
  row: { pdf_storage_bucket?: string | null; pdf_storage_key?: string | null },
  bucket = "invoices"
): boolean {
  return (
    row.pdf_storage_bucket === bucket &&
    row.pdf_storage_key != null &&
    String(row.pdf_storage_key).trim() !== ""
  );
}
