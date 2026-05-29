/** Due-date helpers for the invoice editor (issue date + grace period). */

export function addDaysToYmd(ymd: string, days: number): string {
  const base = String(ymd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return base;
  d.setUTCDate(d.getUTCDate() + Math.max(0, days));
  return d.toISOString().slice(0, 10);
}

export function dueDateFromIssueDate(issueDate: string, gracePeriodDays: number): string {
  return addDaysToYmd(issueDate, gracePeriodDays);
}

export type PropertyTenantOption = {
  id: string;
  fullName: string;
  email: string | null;
  leaseId: string | null;
  monthlyRent: number | null;
  leaseReference: string | null;
};

export function mapPropertyTenantRow(row: Record<string, unknown>): PropertyTenantOption {
  const first = String(row.firstName ?? row.first_name ?? "").trim();
  const last = String(row.lastName ?? row.last_name ?? "").trim();
  const fullName = `${first} ${last}`.trim() || "Tenant";
  const currentLease = (row.currentLease ?? null) as Record<string, unknown> | null;
  const leaseId = currentLease?.id != null ? String(currentLease.id) : null;
  const monthlyRentRaw = currentLease?.monthlyRent ?? currentLease?.monthly_rent;
  const monthlyRent =
    monthlyRentRaw != null && Number.isFinite(Number(monthlyRentRaw)) ? Number(monthlyRentRaw) : null;
  const refRaw = currentLease?.leaseReference ?? currentLease?.lease_reference;
  const leaseReference = refRaw != null && String(refRaw).trim() ? String(refRaw).trim() : null;
  return {
    id: String(row.id),
    fullName,
    email: row.email != null ? String(row.email) : null,
    leaseId,
    monthlyRent,
    leaseReference
  };
}
