import { Link } from "react-router-dom";
import type { TenantListItem } from "./tenantDirectoryTypes";
import { fmtZar, tenantInitials } from "./tenantDirectoryUtils";
import { LeaseStatusBadge, PaymentStatusBadge } from "./TenantStatusBadges";
import { TenantRowActions } from "./TenantRowActions";

export function TenantMobileCard({ tenant }: { tenant: TenantListItem }) {
  return (
    <article className="pg-tenants-mobile-card pg-workspace-card">
      <div className="pg-tenants-mobile-card-top">
        <div className="pg-tenants-mobile-card-id">
          <span className="pg-tenants-avatar" aria-hidden>
            {tenantInitials(tenant)}
          </span>
          <div>
            <Link className="pg-tenants-name" to={`/tenants/${tenant.id}`}>
              {tenant.fullName}
            </Link>
            <div className="pg-tenants-sub pg-tenants-mobile-property">
              {tenant.propertyName || "No property assigned"}
              {tenant.unitNumber ? ` · ${tenant.unitNumber}` : ""}
            </div>
          </div>
        </div>
        <div className="pg-tenants-mobile-rent">
          <strong>{tenant.monthlyRent != null ? fmtZar(tenant.monthlyRent) : "—"}</strong>
          {tenant.monthlyRent != null ? <span className="pg-tenants-sub"> /mo</span> : null}
        </div>
      </div>
      <div className="pg-tenants-sub">{tenant.phone?.trim() || "No phone"}</div>
      <div className="pg-tenants-mobile-card-foot">
        <div className="pg-tenants-mobile-badges">
          <PaymentStatusBadge status={tenant.paymentStatus} />
          <LeaseStatusBadge status={tenant.leaseStatus} />
        </div>
        <TenantRowActions tenant={tenant} />
      </div>
    </article>
  );
}

export function TenantMobileList({
  items,
  loading
}: {
  items: TenantListItem[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="pg-tenants-mobile-list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="pg-workspace-card pg-tenants-mobile-card pg-tenants-mobile-card--skeleton" aria-hidden />
        ))}
      </div>
    );
  }
  return (
    <div className="pg-tenants-mobile-list">
      {items.map((t) => (
        <TenantMobileCard key={t.id} tenant={t} />
      ))}
    </div>
  );
}
