import { readCookieConsent } from "./consent";

export { resetCookieConsent, saveCookieConsent, readCookieConsent } from "./consent";

/** Allowed custom parameter keys (non-PII). */
const ALLOWED_PARAM_KEYS = new Set([
  "source_page",
  "plan_code",
  "billing_period",
  "calculator_type",
  "report_type",
  "property_type",
  "page_location",
  "page_path",
  "page_title"
]);

/** Keys / substrings that must never be sent to analytics. */
const FORBIDDEN_KEY_PATTERNS = [
  /^email$/i,
  /^name$/i,
  /first_?name/i,
  /last_?name/i,
  /full_?name/i,
  /phone/i,
  /tenant/i,
  /address/i,
  /street/i,
  /suburb/i,
  /city/i,
  /postal/i,
  /invoice/i,
  /bank/i,
  /account_?number/i,
  /iban/i,
  /amount/i,
  /price/i,
  /rent/i,
  /income/i,
  /expense/i,
  /balance/i,
  /payment/i,
  /salary/i,
  /user_?id$/i,
  /uuid/i
];

export type AnalyticsEventParams = Record<string, string | number | boolean>;

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeParams(params?: AnalyticsEventParams): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!params || typeof params !== "object") return out;

  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_PARAM_KEYS.has(key)) continue;
    if (isForbiddenKey(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

export function getSourcePage(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

export function canTrackAnalytics(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (readCookieConsent() !== "accepted") return false;
    const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
    return Array.isArray(dataLayer);
  } catch {
    return false;
  }
}

function pushDataLayer(payload: Record<string, unknown>): void {
  try {
    if (!canTrackAnalytics()) return;
    const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
    if (!Array.isArray(dataLayer)) return;
    dataLayer.push(payload);
  } catch {
    // fail silently
  }
}

/**
 * Push a custom event to GTM dataLayer.
 * Params are filtered to allowed, non-PII keys only.
 */
export function trackEvent(eventName: string, params?: AnalyticsEventParams): void {
  try {
    if (!eventName || typeof eventName !== "string") return;
    const safe = sanitizeParams(params);
    const payload: Record<string, unknown> = {
      event: eventName,
      ...safe
    };
    if (!payload.source_page && typeof window !== "undefined") {
      payload.source_page = getSourcePage();
    }
    pushDataLayer(payload);
  } catch {
    // fail silently
  }
}

/** Client-side SPA page view (route changes only — see AnalyticsRouteTracker). */
export function trackPageView(path?: string, title?: string): void {
  try {
    if (typeof window === "undefined") return;
    const pagePath = path ?? window.location.pathname + window.location.search;
    const pageTitle = title ?? document.title;
    trackEvent("proplytic_page_view", {
      page_location: window.location.origin + pagePath,
      page_path: pagePath,
      page_title: pageTitle,
      source_page: pagePath
    });
  } catch {
    // fail silently
  }
}
