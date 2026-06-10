import { closeReportTab, navigateReportTab, openBlankReportTab } from "./openReportInNewTab";
import { generateReportViaVercel } from "./reportsVercel";
import { trackEvent } from "../lib/analytics/analytics";

/**
 * Generate a property investment report and open it in the browser PDF viewer (new tab).
 */
export async function openPropertyInvestmentReport(propertyId: string): Promise<string> {
  const tab = openBlankReportTab();

  try {
    const gen = await generateReportViaVercel({ reportType: "PROPERTY_SUMMARY", propertyId });
    const url = gen.downloadUrl;
    if (!url) {
      closeReportTab(tab);
      throw new Error(gen.error ?? "Report could not be generated.");
    }

    navigateReportTab(tab, url);
    trackEvent("report_generated", {
      report_type: "property_summary",
      source_page: `${window.location.pathname}${window.location.search}`
    });
    trackEvent("pdf_downloaded", {
      report_type: "property_summary",
      source_page: `${window.location.pathname}${window.location.search}`
    });
    return url;
  } catch (e) {
    closeReportTab(tab);
    throw e;
  }
}
