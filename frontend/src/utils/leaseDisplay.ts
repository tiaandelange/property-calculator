/** Mirrors `backend/src/domains/properties/propertyLease.helpers.ts` for SPA lease rows. */

export function leaseDisplayStatus(lease: {
  status: string;
  fixedTermEndDate?: string | Date | null;
}): string {
  const st = String(lease.status ?? "");
  if (st === "CANCELLED" || st === "TERMINATED" || st === "EXPIRED" || st === "DRAFT") {
    return st;
  }
  const fd = lease.fixedTermEndDate;
  if (fd != null && st === "ACTIVE") {
    const endMs = new Date(fd as string).getTime();
    if (!Number.isNaN(endMs) && endMs < Date.now()) {
      return "MONTH_TO_MONTH";
    }
  }
  return st;
}

export function isCurrentLeaseStatus(displayOrDbStatus: string): boolean {
  return displayOrDbStatus === "ACTIVE" || displayOrDbStatus === "MONTH_TO_MONTH";
}
