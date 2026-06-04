/** Shared SEO / Open Graph config for public marketing routes (no Supabase). */

import seoData from "../../seo/public-pages.json";

export const PUBLIC_SITE_ORIGIN = seoData.siteOrigin;

export const DEFAULT_OG_IMAGE = {
  path: seoData.ogImage.path,
  width: seoData.ogImage.width,
  height: seoData.ogImage.height,
  alt: seoData.ogImage.alt
} as const;

export type PublicPageSeoConfig = {
  title: string;
  description: string;
  /** Path only, e.g. `/calculators` */
  path: string;
};

export const HOME_PAGE_SEO: PublicPageSeoConfig = seoData.staticPages["/"];

export const CALCULATORS_HUB_PAGE_SEO: PublicPageSeoConfig = seoData.staticPages["/calculators"];

export const REPORTS_PAGE_SEO: PublicPageSeoConfig = seoData.staticPages["/reports"];

export const PRICING_PAGE_SEO: PublicPageSeoConfig = seoData.staticPages["/pricing"];

export const FEATURES_PAGE_SEO: PublicPageSeoConfig = seoData.staticPages["/features"];

export const RESOURCES_PAGE_SEO: PublicPageSeoConfig = seoData.staticPages["/resources"];

/**
 * Resolve SEO config for a public pathname (no query string).
 * Returns null for unknown paths (e.g. authenticated app routes).
 */
export function getPublicPageSeoForPath(pathname: string): PublicPageSeoConfig | null {
  const path = pathname.split("?")[0]?.split("#")[0] || "/";
  const normalized = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path || "/";

  if (seoData.staticPages[normalized as keyof typeof seoData.staticPages]) {
    return seoData.staticPages[normalized as keyof typeof seoData.staticPages];
  }

  const calcMatch = /^\/calculators\/([^/]+)$/.exec(normalized);
  if (calcMatch) {
    const slug = calcMatch[1];
    const entry = seoData.calculatorSlugs[slug as keyof typeof seoData.calculatorSlugs];
    if (entry) return entry;
    return {
      title: "Property Calculator | Proplytic",
      description: CALCULATORS_HUB_PAGE_SEO.description,
      path: normalized
    };
  }

  return null;
}

/**
 * Absolute public URL for canonical / Open Graph tags.
 * Prefers VITE_PUBLIC_SITE_URL, then PUBLIC_SITE_ORIGIN, then window.origin in the browser.
 */
export function resolvePublicPageUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return `${configured}${path}`;
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}${path}`;
  }
  return `${PUBLIC_SITE_ORIGIN}${path}`;
}

export function resolveDefaultOgImageUrl(): string {
  return resolvePublicPageUrl(DEFAULT_OG_IMAGE.path);
}

/** User-agent sniffing for link-preview crawlers (edge-safe). */
export function isSocialPreviewCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|slackbot|discordbot|telegrambot|pinterest|embedly|quora link preview|redditbot|googlebot|bingpreview/i.test(
    userAgent
  );
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal HTML document for crawlers that do not execute the SPA. */
export function buildSocialPreviewHtml(seo: PublicPageSeoConfig): string {
  const canonical = resolvePublicPageUrl(seo.path);
  const ogImage = resolvePublicPageUrl(DEFAULT_OG_IMAGE.path);
  const title = escapeHtml(seo.title);
  const description = escapeHtml(seo.description);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Proplytic" />
  <meta property="og:locale" content="en_ZA" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:secure_url" content="${ogImage}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="${String(DEFAULT_OG_IMAGE.width)}" />
  <meta property="og:image:height" content="${String(DEFAULT_OG_IMAGE.height)}" />
  <meta property="og:image:alt" content="${escapeHtml(DEFAULT_OG_IMAGE.alt)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImage}" />
  <meta name="twitter:image:alt" content="${escapeHtml(DEFAULT_OG_IMAGE.alt)}" />
</head>
<body>
  <p><a href="${canonical}">Proplytic</a></p>
</body>
</html>`;
}
