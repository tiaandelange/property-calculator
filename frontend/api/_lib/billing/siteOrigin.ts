import { requireFrontendUrl } from "./billingEnv.js";

/** Public site origin for billing redirect URLs (checkout success/cancel). */
export function publicSiteOrigin(): string {
  return requireFrontendUrl();
}
