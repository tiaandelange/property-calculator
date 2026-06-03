/** Shared SEO helpers for public marketing routes (no Supabase). */

export const HOME_PAGE_SEO = {
  title: "Proplytic | Property Portfolio Analytics & Reports",
  description:
    "Analyse property performance, manage leases and invoices, and generate investor-ready reports for your rental portfolio.",
  path: "/",
  ogImagePath: "/proplytic_icon_500x500_nobg.png"
} as const;

/**
 * Absolute public URL for canonical / Open Graph tags.
 * Prefers VITE_PUBLIC_SITE_URL, then window.origin in the browser.
 */
export function resolvePublicPageUrl(pathname: string): string | null {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return `${configured}${path}`;
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}${path}`;
  }
  return null;
}
