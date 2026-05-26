import type { TenantLeaseStatus } from "../tenants/tenantDirectoryTypes";
import { displayStatusLabel, lifecycleStatusLabel } from "./leaseDirectoryUtils";

export function LeaseLifecycleBadge({ status }: { status: TenantLeaseStatus | null | undefined }) {
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
  return <span className={`pg-leases-badge pg-leases-badge--${tone}`}>{lifecycleStatusLabel(status)}</span>;
}

export function LeaseDisplayStatusBadge({ status }: { status: string | null | undefined }) {
  const s = String(status ?? "").toUpperCase();
  const tone =
    s === "ACTIVE"
      ? "success"
      : s === "MONTH_TO_MONTH"
        ? "info"
        : s === "CANCELLED" || s === "TERMINATED" || s === "EXPIRED"
          ? "danger"
          : s === "DRAFT"
            ? "warning"
            : "neutral";
  return <span className={`pg-leases-badge pg-leases-badge--${tone}`}>{displayStatusLabel(status)}</span>;
}
