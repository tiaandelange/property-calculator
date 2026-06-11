import { fetchPdfBlob, openPdfBlobInNewTab } from "../../api/pdfBlob";
import type { GenerateStatementPdfResponse } from "../../services/tenantStatementsVercel";
import { closeReportTab } from "../../services/openReportInNewTab";

export async function openStatementPdfExport(
  gen: GenerateStatementPdfResponse,
  previewTab?: Window | null
): Promise<void> {
  const downloadUrl = gen.downloadUrl;
  if (!downloadUrl) {
    closeReportTab(previewTab ?? null);
    throw new Error(gen.error ?? "No download URL returned.");
  }
  try {
    const blob = await fetchPdfBlob(downloadUrl);
    closeReportTab(previewTab ?? null);
    openPdfBlobInNewTab(blob);
  } catch (e) {
    closeReportTab(previewTab ?? null);
    throw e;
  }
}

export function statementPdfWasStored(gen: GenerateStatementPdfResponse): boolean {
  return Boolean(gen.hasPdf && !gen.ephemeral);
}
