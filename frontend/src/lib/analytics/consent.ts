/** localStorage key for cookie / analytics consent choice. */
export const COOKIE_CONSENT_STORAGE_KEY = "proplytic_cookie_consent";

export type CookieConsentChoice = "accepted" | "rejected";

type GtagFn = (...args: unknown[]) => void;

function gtagSafe(...args: unknown[]): void {
  try {
    if (typeof window === "undefined") return;
    const gtag = (window as Window & { gtag?: GtagFn }).gtag;
    if (typeof gtag === "function") gtag(...args);
  } catch {
    // fail silently
  }
}

export function readCookieConsent(): CookieConsentChoice | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (raw === "accepted" || raw === "rejected") return raw;
    return null;
  } catch {
    return null;
  }
}

export function hasCookieConsentChoice(): boolean {
  return readCookieConsent() != null;
}

export function saveCookieConsent(choice: CookieConsentChoice): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
  } catch {
    // ignore quota / private mode
  }
  applyConsentUpdate(choice);
}

/** Re-apply stored consent after page load (called from bootstrap). */
export function applyConsentUpdate(choice: CookieConsentChoice): void {
  const granted = choice === "accepted";
  gtagSafe("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: granted ? "granted" : "denied"
  });
}

/** Clear saved choice so the banner can show again (e.g. settings). */
export function resetCookieConsent(): void {
  try {
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
