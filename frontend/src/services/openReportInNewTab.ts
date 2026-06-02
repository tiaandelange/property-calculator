/**
 * Open a report PDF in a single new tab.
 *
 * Call `openBlankReportTab()` synchronously from a click handler, then after async
 * generation call `navigateReportTab(tab, downloadUrl)`. Do not pass `noopener` on the
 * initial open — it prevents navigating the tab and leaves a stray about:blank tab.
 */

/** Synchronous (user-gesture) placeholder tab; returns null if the browser blocked it. */
export function openBlankReportTab(): Window | null {
  return window.open("", "_blank");
}

export function navigateReportTab(tab: Window | null, downloadUrl: string): void {
  const url = downloadUrl.trim();
  if (!url) throw new Error("Missing download URL.");

  if (tab && !tab.closed) {
    tab.location.href = url;
    return;
  }

  const opened = window.open(url, "_blank");
  if (!opened) {
    throw new Error("Unable to open report. Allow pop-ups for this site.");
  }
}

export function closeReportTab(tab: Window | null): void {
  if (!tab || tab.closed) return;
  try {
    tab.close();
  } catch {
    // ignore
  }
}
