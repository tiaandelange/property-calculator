import type { TenantListItem } from "./tenantDirectoryTypes";

export function TenantCoTenantBadge({ tenant }: { tenant: TenantListItem }) {
  if (!tenant.isCoTenant) return null;

  return (
    <div className="pg-tenants-co-tenant-hint" style={{ marginTop: 4 }}>
      <span className="pg-tenants-badge pg-tenants-badge--info">Co-tenant</span>
      <span className="pg-tenants-sub" style={{ marginLeft: 6 }}>
        Shared lease — rent counted once
        {tenant.primaryTenantName ? ` (${tenant.primaryTenantName})` : ""}
      </span>
    </div>
  );
}
