import { fetchPdfBlob, isAbsoluteHttpUrl } from "../../api/pdfBlob";
import type { GenerateInvoicePdfResponse } from "../../services/invoicesVercel";

/** Open invoice PDF in a new browser tab — same pattern as property report PDF export. */
export async function openInvoicePdfExport(gen: GenerateInvoicePdfResponse): Promise<void> {
  const downloadUrl = gen.downloadUrl;
  if (!downloadUrl) throw new Error(gen.error ?? "No download URL returned.");
  if (isAbsoluteHttpUrl(downloadUrl)) {
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const blob = await fetchPdfBlob(downloadUrl);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function invoicePdfWasStored(gen: GenerateInvoicePdfResponse): boolean {
  return Boolean(gen.hasPdf && !gen.ephemeral);
}
