export function getAuthRedirectOrigin(): string {
  const explicit = (import.meta.env.VITE_PUBLIC_SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return window.location.origin;
}

export function getConfirmEmailRedirectUrl(): string {
  return `${getAuthRedirectOrigin()}/confirm-email`;
}

