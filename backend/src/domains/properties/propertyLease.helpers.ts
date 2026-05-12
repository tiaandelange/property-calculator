/** Lease display rules shared across aggregate, dashboard, and routes. */

export function leaseDisplayStatus(lease: { status: string; fixedTermEndDate: Date | null }) {
  if (lease.status === "CANCELLED" || lease.status === "TERMINATED" || lease.status === "EXPIRED" || lease.status === "DRAFT") {
    return lease.status;
  }
  if (lease.fixedTermEndDate && lease.fixedTermEndDate.getTime() < Date.now() && lease.status === "ACTIVE") {
    return "MONTH_TO_MONTH";
  }
  return lease.status;
}

export function isCurrentLeaseStatus(displayOrDbStatus: string) {
  return displayOrDbStatus === "ACTIVE" || displayOrDbStatus === "MONTH_TO_MONTH";
}
