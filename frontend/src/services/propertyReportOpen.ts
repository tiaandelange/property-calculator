import { generateReportViaVercel } from "./reportsVercel";

/**
 * Generate a property investment report and open it in the browser PDF viewer (new tab).
 */
export async function openPropertyInvestmentReport(propertyId: string): Promise<string> {
  // Open a tab synchronously (user gesture) so browsers don't block it.
  const opened = window.open("about:blank", "_blank", "noopener,noreferrer");

  const gen = await generateReportViaVercel({ reportType: "PROPERTY_SUMMARY", propertyId });
  const url = gen.downloadUrl;
  if (!url) {
    try {
      opened?.close();
    } catch {
      // ignore
    }
    throw new Error(gen.error ?? "Report could not be generated.");
  }

  if (opened) {
    opened.location.href = url;
  } else {
    // Fallback: attempt to open after async (may still be blocked).
    const fallback = window.open(url, "_blank", "noopener,noreferrer");
    if (!fallback) {
      window.alert(
        "Pop-up blocked. Allow pop-ups for this site, or open the report from the Reports page."
      );
    }
  }

  return url;
}
