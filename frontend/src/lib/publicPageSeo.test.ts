import { describe, expect, it } from "vitest";
import {
  buildSocialPreviewHtml,
  getPublicPageSeoForPath,
  isSocialPreviewCrawler,
  resolvePublicPageUrl
} from "./publicPageSeo";

describe("publicPageSeo", () => {
  it("detects social preview crawlers", () => {
    expect(isSocialPreviewCrawler("facebookexternalhit/1.1")).toBe(true);
    expect(isSocialPreviewCrawler("WhatsApp/2.24")).toBe(true);
    expect(isSocialPreviewCrawler("Mozilla/5.0 Chrome/120")).toBe(false);
  });

  it("resolves known public paths", () => {
    expect(getPublicPageSeoForPath("/")?.title).toContain("Property Portfolio Software");
    expect(getPublicPageSeoForPath("/calculators")?.title).toContain("Calculators");
    expect(getPublicPageSeoForPath("/calculators/monthly-bond-payment")?.path).toBe(
      "/calculators/monthly-bond-payment"
    );
    expect(getPublicPageSeoForPath("/calculators/rental-cash-flow")?.title).toContain("Cash Flow");
  });

  it("builds OG HTML with absolute image URL", () => {
    const html = buildSocialPreviewHtml(getPublicPageSeoForPath("/")!);
    expect(html).toContain("https://proplytic.co.za/social/proplytic-og-home.png");
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain("summary_large_image");
  });

  it("uses production origin when env and window are unavailable", () => {
    expect(resolvePublicPageUrl("/reports")).toBe("https://proplytic.co.za/reports");
  });
});
