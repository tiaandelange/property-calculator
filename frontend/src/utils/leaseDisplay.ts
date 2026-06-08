/** Mirrors `backend/src/domains/properties/propertyLease.helpers.ts` for SPA lease rows. */

function parseDateOnly(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const s = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function todayDateOnly(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** True when a cancellation is scheduled for a future date (lease remains active until then). */
export function isScheduledCancellationActive(
  cancellationDate: string | Date | null | undefined,
  now = new Date()
): boolean {
  const cd = parseDateOnly(cancellationDate);
  if (!cd) return false;
  return cd.getTime() > todayDateOnly(now).getTime();
}

export function leaseDisplayStatus(lease: {
  status: string;
  fixedTermEndDate?: string | Date | null;
  cancellationDate?: string | Date | null;
}): string {
  const st = String(lease.status ?? "").toUpperCase();
  const cancelPending = isScheduledCancellationActive(lease.cancellationDate);

  if (cancelPending) {
    const fd = lease.fixedTermEndDate;
    if (fd != null) {
      const end = parseDateOnly(fd);
      if (end && end.getTime() < todayDateOnly().getTime()) {
        return "MONTH_TO_MONTH";
      }
    }
    return "ACTIVE";
  }

  if (st === "CANCELLED" || st === "TERMINATED" || st === "EXPIRED" || st === "DRAFT") {
    return st;
  }

  const fd = lease.fixedTermEndDate;
  if (fd != null && st === "ACTIVE") {
    const end = parseDateOnly(fd);
    if (end && end.getTime() < todayDateOnly().getTime()) {
      return "MONTH_TO_MONTH";
    }
  }
  return st;
}

export function isCurrentLeaseStatus(displayOrDbStatus: string): boolean {
  return displayOrDbStatus === "ACTIVE" || displayOrDbStatus === "MONTH_TO_MONTH";
}

export function isLeaseCurrentlyActive(lease: {
  status: string;
  fixedTermEndDate?: string | Date | null;
  cancellationDate?: string | Date | null;
}): boolean {
  return isCurrentLeaseStatus(leaseDisplayStatus(lease));
}
