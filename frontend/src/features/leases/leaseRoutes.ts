/** Canonical navigation to a property's leases tab, optionally highlighting a lease card. */
export function propertyLeasesPath(propertyId: string, leaseId?: string | null): string {
  const pid = encodeURIComponent(String(propertyId));
  const base = `/owned-properties/${pid}?tab=leases`;
  if (leaseId == null || leaseId === "") return base;
  return `${base}&leaseId=${encodeURIComponent(String(leaseId))}`;
}
