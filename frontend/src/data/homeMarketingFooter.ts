import { homepageCalculators } from "./homepageCalculators";

/** Public marketing name for copyright and brand lockup. */
export const HOMEPAGE_BRAND_LEGAL_NAME = "The Property Guy";

export const marketingFooterBrandTagline =
  "Make better property decisions with calculators built for the real cost of buying, owning and investing.";

/**
 * Footer “Calculators” column — labels and routes come only from `homepageCalculators`
 * (central homepage calculator registry). Do not duplicate `/calculators/:slug` paths here.
 */
export const marketingFooterCalculatorNavItems: readonly { readonly label: string; readonly to: string }[] =
  homepageCalculators.map((c) => ({ label: c.title, to: c.route }));

export const marketingFooterCompanyLinks = [
  { label: "How it works", to: "/#how-it-works" },
  { label: "Why us", to: "/#why-us" },
  { label: "Reviews", to: "/#reviews" },
  { label: "Contact", to: "/contact" }
] as const;

/**
 * TODO(legal): Replace placeholder `SimplePage` targets in `App.tsx` with real policy routes
 * or CMS-backed pages when legal content is ready. Routes exist so links are never 404.
 */
export const marketingFooterLegalLinks = [
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Use", to: "/terms" },
  { label: "Cookie Notice", to: "/cookie-notice" }
] as const;

export const marketingFooterLegalDisclaimer =
  "Calculator outputs are estimates and should be checked before you act.";
