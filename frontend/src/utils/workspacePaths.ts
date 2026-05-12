/**
 * Routes that render inside the signed-in left-rail workspace chrome when a token is present.
 * Public marketing pages (home, calculators hub/detail, contact, help, etc.) use the same
 * marketing header/footer as the homepage even when signed in.
 */
const WORKSPACE_PREFIXES = [
  "/dashboard",
  "/owned-properties",
  "/tenants",
  "/leases",
  "/financials",
  "/invoices",
  "/documents",
  "/account",
  "/subscription",
  "/admin",
  "/settings"
];

export function isWorkspacePath(pathname: string): boolean {
  return WORKSPACE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
