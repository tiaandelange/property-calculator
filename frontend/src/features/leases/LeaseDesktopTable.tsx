import { Link } from "react-router-dom";
import type { LeaseListItem } from "./leaseDirectoryTypes";
import { fmtZar, formatDateShort, tenantInitialsFromName } from "./leaseDirectoryUtils";
import { LeaseDisplayStatusBadge, LeaseLifecycleBadge } from "./LeaseStatusBadges";
import { LeaseRowActions } from "./LeaseRowActions";

export function LeaseDesktopTable({
  items,
  loading,
  onCancelLease
}: {
  items: LeaseListItem[];
  loading?: boolean;
  onCancelLease?: (leaseId: string) => void;
}) {
  if (loading) {
    return (
      <div className="pg-leases-table-wrap">
        <div className="pg-leases-table-skeleton" aria-hidden />
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="pg-leases-table-wrap">
      <table className="pg-leases-table">
        <thead>
          <tr>
            <th scope="col">Tenant</th>
            <th scope="col">Property</th>
            <th scope="col">Monthly Rent</th>
            <th scope="col">Lease Term</th>
            <th scope="col">Rent Due</th>
            <th scope="col">Deposit</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="pg-leases-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((lease) => (
            <tr key={lease.id}>
              <td>
                <div className="pg-leases-cell-tenant">
                  <span className="pg-leases-avatar" aria-hidden>
                    {tenantInitialsFromName(lease.tenantName)}
                  </span>
                  <div className="pg-leases-cell-tenant-text">
                    {lease.tenantId ? (
                      <Link className="pg-leases-name" to={`/tenants/${lease.tenantId}`}>
                        {lease.tenantName}
                      </Link>
                    ) : (
                      <span className="pg-leases-name">{lease.tenantName}</span>
                    )}
                    <div className="pg-leases-sub">{lease.leaseTypeLabel}</div>
                  </div>
                </div>
              </td>
              <td>
                <div className="pg-leases-property">
                  <Link className="pg-leases-name" to={`/owned-properties/${lease.propertyId}`}>
                    <strong>{lease.propertyName}</strong>
                  </Link>
                  <div className="pg-leases-sub">{lease.propertyAddress || "—"}</div>
                </div>
              </td>
              <td>
                <div className="pg-leases-rent">
                  <strong>{lease.monthlyRent != null ? fmtZar(lease.monthlyRent) : "—"}</strong>
                  {lease.monthlyRent != null ? <div className="pg-leases-sub">/ month</div> : null}
                </div>
              </td>
              <td>
                {lease.startDate || lease.endDate ? (
                  <div className="pg-leases-term">
                    <div>{formatDateShort(lease.startDate)}</div>
                    <div className="pg-leases-sub">to {formatDateShort(lease.endDate)}</div>
                  </div>
                ) : (
                  <span className="pg-leases-sub">—</span>
                )}
              </td>
              <td>
                <div className="pg-leases-due">{lease.rentDueDay != null ? `Day ${lease.rentDueDay}` : "—"}</div>
              </td>
              <td>
                <strong className="pg-leases-deposit">{lease.depositAmount != null ? fmtZar(lease.depositAmount) : "—"}</strong>
              </td>
              <td>
                <div className="pg-leases-status-stack">
                  <LeaseLifecycleBadge status={lease.lifecycleStatus} />
                  <LeaseDisplayStatusBadge status={lease.displayStatus} />
                </div>
              </td>
              <td>
                <LeaseRowActions lease={lease} onCancel={onCancelLease} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
