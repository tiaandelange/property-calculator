import { isCurrentLeaseStatus, leaseDisplayStatus } from "../../utils/leaseDisplay";

export function tenantLeasesFromRecord(tenant: Record<string, unknown>): Record<string, unknown>[] {
  const leases = tenant.leases;
  return Array.isArray(leases) ? (leases as Record<string, unknown>[]) : [];
}

function leaseDisplayInput(lease: Record<string, unknown>) {
  return {
    status: String(lease.status ?? ""),
    fixedTermEndDate: (lease.fixedTermEndDate ?? lease.fixed_term_end_date) as string | null,
    cancellationDate: (lease.cancellationDate ?? lease.cancellation_date) as string | null
  };
}

/** Active lease, scheduled-cancel lease, or most recent lease for workspace context. */
export function pickTenantContextLease(
  tenant: Record<string, unknown>,
  currentLease: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (currentLease?.id != null) return currentLease;

  const leases = tenantLeasesFromRecord(tenant);
  if (!leases.length) return null;

  const sorted = [...leases].sort(
    (a, b) =>
      new Date(String(b.createdAt ?? b.created_at ?? b.startDate ?? b.start_date ?? 0)).getTime() -
      new Date(String(a.createdAt ?? a.created_at ?? a.startDate ?? a.start_date ?? 0)).getTime()
  );

  const active = sorted.find((l) => isCurrentLeaseStatus(leaseDisplayStatus(leaseDisplayInput(l))));
  return active ?? sorted.find((l) => l.propertyId != null || l.property_id != null) ?? sorted[0] ?? null;
}

/** Resolve property id/name when tenant.property_id is unset but a lease exists (including past leases). */
export function resolveTenantPropertyId(
  tenant: Record<string, unknown>,
  currentLease: Record<string, unknown> | null
): string {
  const contextLease = pickTenantContextLease(tenant, currentLease);
  const property = (tenant.property ?? null) as Record<string, unknown> | null;
  if (property?.id != null) return String(property.id);
  if (tenant.propertyId != null && String(tenant.propertyId) !== "") return String(tenant.propertyId);
  if (contextLease?.propertyId != null && String(contextLease.propertyId) !== "") {
    return String(contextLease.propertyId);
  }
  const leaseProperty = (contextLease?.property ?? null) as Record<string, unknown> | null;
  if (leaseProperty?.id != null) return String(leaseProperty.id);
  return "";
}

export function resolveTenantPropertyName(
  tenant: Record<string, unknown>,
  currentLease: Record<string, unknown> | null,
  fallback = "Property"
): string {
  const contextLease = pickTenantContextLease(tenant, currentLease);
  const property = (tenant.property ?? null) as Record<string, unknown> | null;
  if (property?.name != null) return String(property.name);
  const leaseProperty = (contextLease?.property ?? null) as Record<string, unknown> | null;
  if (leaseProperty?.name != null) return String(leaseProperty.name);
  return fallback;
}
