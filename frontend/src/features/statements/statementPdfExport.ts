import { fetchPdfBlob, isAbsoluteHttpUrl, openPdfBlobInNewTab } from "../../api/pdfBlob";
import type { GenerateStatementPdfResponse } from "../../services/tenantStatementsVercel";
import { closeReportTab, navigateReportTab } from "../../services/openReportInNewTab";

export async function openStatementPdfExport(
  gen: GenerateStatementPdfResponse,
  previewTab?: Window | null
): Promise<void> {
  const downloadUrl = gen.downloadUrl;
  if (!downloadUrl) {
    closeReportTab(previewTab ?? null);
    throw new Error(gen.error ?? "No download URL returned.");
  }
  if (isAbsoluteHttpUrl(downloadUrl)) {
    navigateReportTab(previewTab ?? null, downloadUrl);
    return;
  }
  const blob = await fetchPdfBlob(downloadUrl);
  if (previewTab && !previewTab.closed) {
    const objectUrl = URL.createObjectURL(blob);
    previewTab.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }
  openPdfBlobInNewTab(blob);
}

export function statementPdfWasStored(gen: GenerateStatementPdfResponse): boolean {
  return Boolean(gen.hasPdf && !gen.ephemeral);
}
