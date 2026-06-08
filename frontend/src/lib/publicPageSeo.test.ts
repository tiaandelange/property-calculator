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

  it("detects Googlebot for edge middleware previews", () => {
    expect(isSocialPreviewCrawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(
      true
    );
  });

  it("resolves known public paths", () => {
    expect(getPublicPageSeoForPath("/")?.title).toContain("Property Portfolio Software");
    expect(getPublicPageSeoForPath("/calculators")?.title).toContain("Calculators");
    expect(getPublicPageSeoForPath("/calculators/monthly-payment")?.path).toBe("/calculators/monthly-payment");
    expect(getPublicPageSeoForPath("/calculators/cash-flow")?.title).toContain("Cash Flow");
    expect(getPublicPageSeoForPath("/pricing")?.title).toContain("Pricing");
  });

  it("resolves applicant invite link previews", () => {
    const seo = getPublicPageSeoForPath("/apply/abc123token");
    expect(seo?.title).toBe("Apply Here | Proplytic");
    expect(seo?.path).toBe("/apply/abc123token");
    expect(seo?.description).toMatch(/rental application/i);
  });

  it("builds OG HTML with absolute image URL", () => {
    const html = buildSocialPreviewHtml(getPublicPageSeoForPath("/")!);
    expect(html).toContain("https://www.proplytic.co.za/social/proplytic-og-home.png");
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain("summary_large_image");
  });

  it("uses production origin when env and window are unavailable", () => {
    expect(resolvePublicPageUrl("/reports")).toBe("https://www.proplytic.co.za/reports");
  });
});
