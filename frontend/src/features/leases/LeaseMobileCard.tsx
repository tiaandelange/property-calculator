import { Link } from "react-router-dom";
import type { LeaseListItem } from "./leaseDirectoryTypes";
import { fmtZar, formatDateShort, tenantInitialsFromName } from "./leaseDirectoryUtils";
import { LeaseDisplayStatusBadge, LeaseLifecycleBadge } from "./LeaseStatusBadges";
import { LeaseRowActions } from "./LeaseRowActions";

export function LeaseMobileCard({
  lease,
  onCancelLease,
  onDeleteLease
}: {
  lease: LeaseListItem;
  onCancelLease?: (leaseId: string) => void;
  onDeleteLease?: (leaseId: string) => void;
}) {
  return (
    <article className="pg-leases-mobile-card pg-workspace-card">
      <div className="pg-leases-mobile-card-top">
        <div className="pg-leases-mobile-card-id">
          <span className="pg-leases-avatar" aria-hidden>
            {tenantInitialsFromName(lease.tenantName)}
          </span>
          <div>
            {lease.tenantId ? (
              <Link className="pg-leases-name" to={`/tenants/${lease.tenantId}`}>
                {lease.tenantName}
              </Link>
            ) : (
              <span className="pg-leases-name">{lease.tenantName}</span>
            )}
            <div className="pg-leases-sub pg-leases-mobile-property">
              <Link to={`/owned-properties/${lease.propertyId}`}>{lease.propertyName}</Link>
            </div>
          </div>
        </div>
        <div className="pg-leases-mobile-rent">
          <strong>{lease.monthlyRent != null ? fmtZar(lease.monthlyRent) : "—"}</strong>
          {lease.monthlyRent != null ? <span className="pg-leases-sub"> /mo</span> : null}
        </div>
      </div>
      <div className="pg-leases-sub">
        {formatDateShort(lease.startDate)} – {formatDateShort(lease.endDate)} · Due day {lease.rentDueDay ?? "—"} · Deposit{" "}
        {lease.depositAmount != null ? fmtZar(lease.depositAmount) : "—"}
      </div>
      <div className="pg-leases-mobile-card-foot">
        <div className="pg-leases-mobile-badges">
          <LeaseLifecycleBadge status={lease.lifecycleStatus} />
          <LeaseDisplayStatusBadge status={lease.displayStatus} />
        </div>
        <LeaseRowActions lease={lease} onCancel={onCancelLease} onDelete={onDeleteLease} />
      </div>
    </article>
  );
}

export function LeaseMobileList({
  items,
  loading,
  onCancelLease,
  onDeleteLease
}: {
  items: LeaseListItem[];
  loading?: boolean;
  onCancelLease?: (leaseId: string) => void;
  onDeleteLease?: (leaseId: string) => void;
}) {
  if (loading) {
    return (
      <div className="pg-leases-mobile-list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="pg-workspace-card pg-leases-mobile-card pg-leases-mobile-card--skeleton" aria-hidden />
        ))}
      </div>
    );
  }
  return (
    <div className="pg-leases-mobile-list">
      {items.map((lease) => (
        <LeaseMobileCard key={lease.id} lease={lease} onCancelLease={onCancelLease} onDeleteLease={onDeleteLease} />
      ))}
    </div>
  );
}
