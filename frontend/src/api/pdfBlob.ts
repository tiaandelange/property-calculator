import { readAuthSession } from "../lib/authSession";

/** Normalizes legacy `/api/...` paths to same-origin fetch paths. */
export function normalizeDownloadPath(downloadUrl: string): string {
  const trimmed = downloadUrl.trim();
  if (trimmed.startsWith("/api/")) return trimmed;
  if (trimmed.startsWith("api/")) return `/${trimmed}`;
  return trimmed;
}

export function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/**
 * Fetches a PDF blob using a signed URL or same-origin path with the Supabase session.
 * Legacy disk-backed `/api/reports/:id/download` paths are no longer served — regenerate the PDF.
 */
export async function fetchPdfBlob(downloadUrl: string): Promise<Blob> {
  const url = downloadUrl.trim();
  if (!url) throw new Error("Missing download URL.");
  if (url.includes("/reports/") && url.includes("/download")) {
    throw new Error(
      "This report was saved before Supabase Storage. Open the calculator and use Regenerate PDF."
    );
  }

  if (isAbsoluteHttpUrl(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status}).`);
    return res.blob();
  }

  const { session, error } = await readAuthSession();
  if (error) throw error;
  const token = session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const path = normalizeDownloadPath(url);
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  return res.blob();
}

export function openPdfBlobInNewTab(blob: Blob): void {
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function triggerPdfFileDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

export async function downloadAuthenticatedPdf(downloadUrl: string, fileName: string): Promise<void> {
  const blob = await fetchPdfBlob(downloadUrl);
  triggerPdfFileDownload(blob, fileName);
}
