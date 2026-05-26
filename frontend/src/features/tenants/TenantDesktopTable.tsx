import { Link } from "react-router-dom";
import type { TenantListItem } from "./tenantDirectoryTypes";
import { fmtZar, formatDateShort, tenantInitials } from "./tenantDirectoryUtils";
import { LeaseStatusBadge, PaymentStatusBadge } from "./TenantStatusBadges";
import { TenantRowActions } from "./TenantRowActions";

function TenantAvatar({ tenant }: { tenant: TenantListItem }) {
  return (
    <span className="pg-tenants-avatar" aria-hidden>
      {tenantInitials(tenant)}
    </span>
  );
}

export function TenantDesktopTable({
  items,
  loading
}: {
  items: TenantListItem[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="pg-tenants-table-wrap">
        <div className="pg-tenants-table-skeleton" aria-hidden />
      </div>
    );
  }

  if (!items.length) {
    return null;
  }

  return (
    <div className="pg-tenants-table-wrap">
      <table className="pg-tenants-table">
        <thead>
          <tr>
            <th scope="col">Tenant</th>
            <th scope="col">Property / Unit</th>
            <th scope="col">Contact</th>
            <th scope="col">Monthly Rent</th>
            <th scope="col">Lease Term</th>
            <th scope="col">Payment Status</th>
            <th scope="col">Lease Status</th>
            <th scope="col">
              <span className="pg-tenants-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <div className="pg-tenants-cell-tenant">
                  <TenantAvatar tenant={t} />
                  <div className="pg-tenants-cell-tenant-text">
                    <Link className="pg-tenants-name" to={`/tenants/${t.id}`}>
                      {t.fullName}
                    </Link>
                    <div className="pg-tenants-sub">{t.email?.trim() || "No email"}</div>
                  </div>
                </div>
              </td>
              <td>
                <div className="pg-tenants-property">
                  <strong>{t.propertyName || "No property assigned"}</strong>
                  <div className="pg-tenants-sub">
                    {t.propertyAddress || "—"}
                    {t.unitNumber ? ` · Unit ${t.unitNumber}` : ""}
                  </div>
                </div>
              </td>
              <td>
                <div className="pg-tenants-contact">{t.phone?.trim() || "No phone"}</div>
              </td>
              <td>
                <div className="pg-tenants-rent">
                  <strong>{t.monthlyRent != null ? fmtZar(t.monthlyRent) : "—"}</strong>
                  {t.monthlyRent != null ? <div className="pg-tenants-sub">/ month</div> : null}
                </div>
              </td>
              <td>
                {t.leaseStartDate || t.leaseEndDate ? (
                  <div className="pg-tenants-term">
                    <div>{formatDateShort(t.leaseStartDate)}</div>
                    <div className="pg-tenants-sub">to {formatDateShort(t.leaseEndDate)}</div>
                  </div>
                ) : (
                  <span className="pg-tenants-sub">No active lease</span>
                )}
              </td>
              <td>
                <PaymentStatusBadge status={t.paymentStatus} />
              </td>
              <td>
                <LeaseStatusBadge status={t.leaseStatus} />
              </td>
              <td>
                <TenantRowActions tenant={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
