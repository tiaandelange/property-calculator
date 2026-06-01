/** Resolve property id/name when tenant.property_id is unset but an active lease exists. */
export function resolveTenantPropertyId(
  tenant: Record<string, unknown>,
  currentLease: Record<string, unknown> | null
): string {
  const property = (tenant.property ?? null) as Record<string, unknown> | null;
  if (property?.id != null) return String(property.id);
  if (tenant.propertyId != null && String(tenant.propertyId) !== "") return String(tenant.propertyId);
  if (currentLease?.propertyId != null && String(currentLease.propertyId) !== "") {
    return String(currentLease.propertyId);
  }
  const leaseProperty = (currentLease?.property ?? null) as Record<string, unknown> | null;
  if (leaseProperty?.id != null) return String(leaseProperty.id);
  return "";
}

export function resolveTenantPropertyName(
  tenant: Record<string, unknown>,
  currentLease: Record<string, unknown> | null,
  fallback = "Property"
): string {
  const property = (tenant.property ?? null) as Record<string, unknown> | null;
  if (property?.name != null) return String(property.name);
  const leaseProperty = (currentLease?.property ?? null) as Record<string, unknown> | null;
  if (leaseProperty?.name != null) return String(leaseProperty.name);
  return fallback;
}
