/**
 * Routes that render inside the signed-in left-rail workspace chrome when a Supabase session exists.
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
  "/statements",
  "/documents",
  "/account",
  "/subscription",
  "/admin",
  "/settings"
];

export function isWorkspacePath(pathname: string): boolean {
  if (pathname === "/investment-calculator" || pathname.startsWith("/calculators/report")) return true;
  return WORKSPACE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
