import { ProplyticStatusBadge } from "../../components/tables";
import type { TenantListItem } from "./tenantDirectoryTypes";
import { LeaseStatusBadge } from "./TenantStatusBadges";

function isLeaseCancelled(tenant: TenantListItem): boolean {
  return String(tenant.leaseDisplayStatus ?? "").toUpperCase() === "CANCELLED";
}

export function TenantLeaseStatusCell({
  tenant,
  useProplyticBadge = false
}: {
  tenant: TenantListItem;
  /** Desktop table uses shared Proplytic table badges. */
  useProplyticBadge?: boolean;
}) {
  const cancelled = isLeaseCancelled(tenant);

  return (
    <div className="pg-tenants-lease-status-stack">
      {cancelled ? (
        <span className="pg-tenants-badge pg-tenants-badge--warning">Cancelled</span>
      ) : useProplyticBadge ? (
        <ProplyticStatusBadge status={tenant.leaseStatus} />
      ) : (
        <LeaseStatusBadge status={tenant.leaseStatus} />
      )}
      {tenant.isCoTenant ? (
        <span className="pg-tenants-badge pg-tenants-badge--info">Co-tenant</span>
      ) : null}
    </div>
  );
}
