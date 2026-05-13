/**
 * Maps `public.leases` rows (snake_case, optional embedded `tenants`) to the Express/Prisma
 * camelCase shape used by the SPA.
 */
import { snakeRowToCamel } from "./propertyRowMapping";
import { leaseDisplayStatus } from "../utils/leaseDisplay";

function normalizeTenantEmbed(c: Record<string, unknown>): void {
  const raw = c.tenants ?? c.tenant;
  if (Array.isArray(raw)) {
    const first = raw[0];
    c.tenant =
      first && typeof first === "object" ? (snakeRowToCamel(first as Record<string, unknown>) as Record<string, unknown>) : null;
  } else if (raw && typeof raw === "object") {
    c.tenant = snakeRowToCamel(raw as Record<string, unknown>) as Record<string, unknown>;
  } else {
    c.tenant = null;
  }
  delete c.tenants;
}

export function dbToLease(row: Record<string, unknown>): Record<string, unknown> {
  const c = { ...snakeRowToCamel(row) } as Record<string, unknown>;
  normalizeTenantEmbed(c);
  const disp = leaseDisplayStatus({
    status: String(c.status ?? ""),
    fixedTermEndDate: (c.fixedTermEndDate as string | Date | null | undefined) ?? null
  });
  return { ...c, displayStatus: disp };
}
