import type { TenantLeaseStatus, TenantPaymentStatus } from "./tenantDirectoryTypes";
import { leaseStatusLabel, paymentStatusLabel } from "./tenantDirectoryUtils";

export function PaymentStatusBadge({ status }: { status: TenantPaymentStatus | null | undefined }) {
  const tone =
    status === "paid"
      ? "success"
      : status === "overdue"
        ? "danger"
        : status === "partial" || status === "pending"
          ? "warning"
          : "neutral";
  return <span className={`pg-tenants-badge pg-tenants-badge--${tone}`}>{paymentStatusLabel(status)}</span>;
}

export function LeaseStatusBadge({ status }: { status: TenantLeaseStatus | null | undefined }) {
  const tone =
    status === "active"
      ? "success"
      : status === "expired"
        ? "danger"
        : status === "ending_soon"
          ? "info"
          : status === "notice"
            ? "warning"
            : "neutral";
  return <span className={`pg-tenants-badge pg-tenants-badge--${tone}`}>{leaseStatusLabel(status)}</span>;
}
