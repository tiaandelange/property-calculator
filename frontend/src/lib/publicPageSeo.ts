/** Shared SEO / Open Graph config for public marketing routes (no Supabase). */

export const PUBLIC_SITE_ORIGIN = "https://proplytic.co.za";

export const DEFAULT_OG_IMAGE = {
  path: "/social/proplytic-og-home.png",
  width: 1200,
  height: 630,
  alt: "Proplytic property portfolio software preview with analytics dashboard, cash flow, property value and portfolio metrics."
} as const;

export type PublicPageSeoConfig = {
  title: string;
  description: string;
  /** Path only, e.g. `/calculators` */
  path: string;
};

export const HOME_PAGE_SEO: PublicPageSeoConfig = {
  title: "Proplytic | Property Portfolio Software South Africa",
  description:
    "Powerful portfolio analytics, property calculators, reports, invoices and tenant management — all in one place.",
  path: "/"
};

export const CALCULATORS_HUB_PAGE_SEO: PublicPageSeoConfig = {
  title: "Property Calculators South Africa | Proplytic",
  description:
    "Use Proplytic’s property calculators to estimate bond payments, transfer costs, rental cash flow, ROI and buying versus renting decisions.",
  path: "/calculators"
};

export const REPORTS_PAGE_SEO: PublicPageSeoConfig = {
  title: "Property PDF Reports South Africa | Proplytic",
  description:
    "Create investor-ready property reports, portfolio summaries, rental statements, invoices and cash flow PDFs with Proplytic.",
  path: "/reports"
};

export const PRICING_PAGE_SEO: PublicPageSeoConfig = {
  title: "Pricing | Proplytic",
  description:
    "Choose a Proplytic plan for property portfolio analytics, calculators, reports, invoices and rental admin.",
  path: "/pricing"
};

export const FEATURES_PAGE_SEO: PublicPageSeoConfig = {
  title: "Property Portfolio Software Features | Proplytic",
  description:
    "Track properties, tenants, leases, income, expenses, invoices, reports and portfolio performance in one connected workspace.",
  path: "/features"
};

export const RESOURCES_PAGE_SEO: PublicPageSeoConfig = {
  title: "Property Calculators & Resources | Proplytic",
  description:
    "Free South African property calculators for bond payments, transfer costs, cash flow, ROI and investment analysis.",
  path: "/calculators"
};

/** Calculator tool paths that use dedicated SEO (slug → config). */
const CALCULATOR_TOOL_SEO: Record<string, PublicPageSeoConfig> = {
  "monthly-payment": {
    title: "Monthly Bond Payment Calculator | Proplytic",
    description:
      "Calculate your estimated monthly home loan repayment, total interest, total repayment and amortisation breakdown.",
    path: "/calculators/monthly-payment"
  },
  "monthly-bond-payment": {
    title: "Monthly Bond Payment Calculator | Proplytic",
    description:
      "Calculate your estimated monthly home loan repayment, total interest, total repayment and amortisation breakdown.",
    path: "/calculators/monthly-bond-payment"
  },
  "buy-vs-rent": {
    title: "Buy vs Rent Calculator | Proplytic",
    description: "Compare the long-term financial outcome of buying a property versus renting over time.",
    path: "/calculators/buy-vs-rent"
  },
  "transfer-bond-costs": {
    title: "Transfer and Bond Costs Calculator South Africa | Proplytic",
    description:
      "Estimate transfer duty, bond registration costs, attorney fees and the total cash needed to register a property in South Africa.",
    path: "/calculators/transfer-bond-costs"
  },
  "cash-flow": {
    title: "Rental Cash Flow Calculator | Proplytic",
    description:
      "Estimate your monthly rental income, operating expenses, debt service and net property cash flow.",
    path: "/calculators/cash-flow"
  },
  "rental-cash-flow": {
    title: "Rental Cash Flow Calculator | Proplytic",
    description:
      "Estimate your monthly rental income, operating expenses, debt service and net property cash flow.",
    path: "/calculators/rental-cash-flow"
  }
};

const STATIC_PUBLIC_PAGES: Record<string, PublicPageSeoConfig> = {
  "/": HOME_PAGE_SEO,
  "/calculators": CALCULATORS_HUB_PAGE_SEO,
  "/reports": REPORTS_PAGE_SEO,
  "/pricing": PRICING_PAGE_SEO,
  "/features": FEATURES_PAGE_SEO,
  "/resources": RESOURCES_PAGE_SEO
};

/**
 * Resolve SEO config for a public pathname (no query string).
 * Returns null for unknown paths (e.g. authenticated app routes).
 */
export function getPublicPageSeoForPath(pathname: string): PublicPageSeoConfig | null {
  const path = pathname.split("?")[0]?.split("#")[0] || "/";
  const normalized = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path || "/";

  if (STATIC_PUBLIC_PAGES[normalized]) {
    return STATIC_PUBLIC_PAGES[normalized];
  }

  const calcMatch = /^\/calculators\/([^/]+)$/.exec(normalized);
  if (calcMatch) {
    const slug = calcMatch[1];
    if (CALCULATOR_TOOL_SEO[slug]) {
      return CALCULATOR_TOOL_SEO[slug];
    }
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
  return /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|slackbot|discordbot|telegrambot|pinterest|embedly|quora link preview|redditbot/i.test(
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
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:secure_url" content="${ogImage}" />
  <meta property="og:image:width" content="${DEFAULT_OG_IMAGE.width}" />
  <meta property="og:image:height" content="${DEFAULT_OG_IMAGE.height}" />
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
