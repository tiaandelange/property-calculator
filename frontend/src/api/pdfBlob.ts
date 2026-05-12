import { api, authHeader } from "./client";

/** Normalizes `/api/reports/1/download` to a path relative to axios `baseURL` (which includes `/api`). */
export function normalizeDownloadPath(downloadUrl: string): string {
  const trimmed = downloadUrl.trim();
  if (trimmed.startsWith("/api/")) return trimmed.slice(4);
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export async function downloadAuthenticatedPdf(downloadUrl: string): Promise<Blob> {
  const rel = normalizeDownloadPath(downloadUrl);
  try {
    const res = await api.get(rel, { headers: authHeader(), responseType: "blob" });
    return res.data as Blob;
  } catch (e: unknown) {
    const err = e as { response?: { data?: Blob }; message?: string };
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text) as { message?: string };
        throw new Error(parsed?.message ?? "Download failed.");
      } catch (inner) {
        if (inner instanceof Error && inner.message !== "Download failed.") throw inner;
        throw new Error("Download failed.");
      }
    }
    throw new Error(err?.message ?? "Download failed.");
  }
}

export function triggerPdfFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function openPdfBlobInNewTab(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return url;
}
