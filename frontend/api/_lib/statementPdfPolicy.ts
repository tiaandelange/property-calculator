const PDF_PERSIST_STATUSES = new Set(["SENT", "DUE", "OVERDUE", "PARTIALLY_PAID", "PAID"]);

export function shouldPersistStatementPdf(status: unknown): boolean {
  return PDF_PERSIST_STATUSES.has(String(status ?? "").toUpperCase());
}

export function statementPdfStorageKey(userId: string, statementId: string): string {
  return `${userId}/tenant-statements/${statementId}.pdf`;
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
