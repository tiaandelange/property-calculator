import { fetchPdfBlob, isAbsoluteHttpUrl, openPdfBlobInNewTab } from "../../api/pdfBlob";
import type { GenerateInvoicePdfResponse } from "../../services/invoicesVercel";

function blobFromBase64Pdf(pdfBase64: string): Blob {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "application/pdf" });
}

/** Open invoice PDF from generate-pdf response (ephemeral base64 or stored signed URL). */
export async function openInvoicePdfExport(gen: GenerateInvoicePdfResponse): Promise<void> {
  if (gen.pdfBase64) {
    openPdfBlobInNewTab(blobFromBase64Pdf(gen.pdfBase64));
    return;
  }
  const downloadUrl = gen.downloadUrl;
  if (!downloadUrl) throw new Error(gen.error ?? "No download URL returned.");
  if (isAbsoluteHttpUrl(downloadUrl)) {
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const blob = await fetchPdfBlob(downloadUrl);
  openPdfBlobInNewTab(blob);
}

export function invoicePdfWasStored(gen: GenerateInvoicePdfResponse): boolean {
  return Boolean(gen.hasPdf && !gen.ephemeral);
}
