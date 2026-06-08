/** True for in-app paths (e.g. `/tenants?tab=applicants`), not `http:` or `mailto:`. */
export function isInternalAppPath(href: string | undefined): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(trimmed);
}
