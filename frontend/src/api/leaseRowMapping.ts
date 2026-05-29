/**
 * Maps `public.leases` rows (snake_case, optional embedded `tenants`) to the Express/Prisma
 * camelCase shape used by the SPA.
 */
import { snakeRowToCamel } from "./propertyRowMapping";
import { leaseDisplayStatus } from "../utils/leaseDisplay";

function normalizePropertyEmbed(c: Record<string, unknown>): void {
  const raw = c.properties ?? c.property;
  if (Array.isArray(raw)) {
    const first = raw[0];
    c.property =
      first && typeof first === "object" ? (snakeRowToCamel(first as Record<string, unknown>) as Record<string, unknown>) : null;
  } else if (raw && typeof raw === "object") {
    c.property = snakeRowToCamel(raw as Record<string, unknown>) as Record<string, unknown>;
  } else {
    c.property = null;
  }
  delete c.properties;
}

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

function normalizeLeaseTenantsEmbed(c: Record<string, unknown>): void {
  const raw = c.leaseTenants ?? c.lease_tenants;
  if (!Array.isArray(raw)) {
    c.leaseTenants = [];
    delete c.lease_tenants;
    return;
  }
  c.leaseTenants = raw.map((row) => {
    const r = snakeRowToCamel(row as Record<string, unknown>) as Record<string, unknown>;
    const tenantRaw = r.tenants ?? r.tenant;
    if (tenantRaw && typeof tenantRaw === "object" && !Array.isArray(tenantRaw)) {
      r.tenant = snakeRowToCamel(tenantRaw as Record<string, unknown>);
    }
    delete r.tenants;
    return r;
  });
  delete c.lease_tenants;
}

export function dbToLease(row: Record<string, unknown>): Record<string, unknown> {
  const c = { ...snakeRowToCamel(row) } as Record<string, unknown>;
  normalizeTenantEmbed(c);
  normalizePropertyEmbed(c);
  normalizeLeaseTenantsEmbed(c);
  const disp = leaseDisplayStatus({
    status: String(c.status ?? ""),
    fixedTermEndDate: (c.fixedTermEndDate as string | Date | null | undefined) ?? null
  });
  return { ...c, displayStatus: disp };
}
