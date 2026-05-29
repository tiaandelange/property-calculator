import { Building2, Eye, Trash2, User, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { LeaseListItem } from "./leaseDirectoryTypes";

export function LeaseRowActions({
  lease,
  onCancel,
  onDelete
}: {
  lease: LeaseListItem;
  onCancel?: (leaseId: string) => void;
  onDelete?: (leaseId: string) => void;
}) {
  return (
    <div className="pg-leases-actions">
      <Link
        to={`/owned-properties/${lease.propertyId}?tab=leases`}
        className="pg-leases-action-btn"
        aria-label={`View property ${lease.propertyName}`}
      >
        <Building2 size={16} aria-hidden />
      </Link>
      {lease.tenantId ? (
        <Link
          to={`/tenants/${lease.tenantId}`}
          className="pg-leases-action-btn"
          aria-label={`View tenant ${lease.tenantName}`}
        >
          <User size={16} aria-hidden />
        </Link>
      ) : (
        <button type="button" className="pg-leases-action-btn" disabled aria-label="No tenant linked">
          <User size={16} aria-hidden />
        </button>
      )}
      <Link
        to={`/owned-properties/${lease.propertyId}?tab=leases`}
        className="pg-leases-action-btn"
        aria-label={`Lease details for ${lease.tenantName}`}
      >
        <Eye size={16} aria-hidden />
      </Link>
      {lease.isCancellable && onCancel ? (
        <button
          type="button"
          className="pg-leases-action-btn"
          aria-label={`Cancel lease for ${lease.tenantName}`}
          title="Cancel lease (keeps history)"
          onClick={() => onCancel(lease.id)}
        >
          <XCircle size={16} aria-hidden />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="pg-leases-action-btn pg-leases-action-btn--danger"
          aria-label={`Permanently delete lease for ${lease.tenantName}`}
          title="Delete permanently"
          onClick={() => onDelete(lease.id)}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
