/**
 * Resolves the Express API base URL for axios (`/api/...` paths).
 *
 * - Set `VITE_API_BASE_URL` (or `VITE_API_URL`) in Vercel / `.env.local` for the Render/Railway backend.
 * - Local dev defaults to `http://localhost:4000/api`.
 * - Production builds without an explicit env use same-origin `/api` (Vercel Functions on this deployment).
 *
 * Supabase data access and same-origin Vercel routes (`fetch("/api/reports/generate")`) do not use this helper.
 */
export function resolveApiBaseUrl(): string {
  const explicit = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL)?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "") || explicit;
  }
  if (import.meta.env.MODE === "development") {
    return "http://localhost:4000/api";
  }
  return "/api";
}

/** Origin for Express-relative paths returned by the API (e.g. `/api/reports/1/download`). */
export function resolveApiOrigin(): string {
  return resolveApiBaseUrl().replace(/\/api\/?$/, "") || "";
}
