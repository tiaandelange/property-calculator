import { generateReportViaVercel } from "./reportsVercel";

/**
 * Generate a property investment report and open it in the browser PDF viewer (new tab).
 */
export async function openPropertyInvestmentReport(propertyId: string): Promise<string> {
  const gen = await generateReportViaVercel({ reportType: "PROPERTY_SUMMARY", propertyId });
  const url = gen.downloadUrl;
  if (!url) throw new Error(gen.error ?? "Report could not be generated.");
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(url);
  }
  return url;
}
