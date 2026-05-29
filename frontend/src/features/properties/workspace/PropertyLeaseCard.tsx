import type { ReactNode } from "react";
import { Pencil, Trash2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

export type PropertyLeaseCardLease = {
  id: string | number;
  leaseType?: string;
  status?: string;
  displayStatus?: string;
  startDate?: string | Date | null;
  fixedTermEndDate?: string | Date | null;
  monthlyRent?: number;
  depositAmount?: number;
  rentDueDay?: number;
  tenantId?: string | number;
  tenant?: { id?: string; firstName?: string; lastName?: string } | null;
};

export function PropertyLeaseCard({
  lease,
  title,
  tenantLabel,
  showEdit = true,
  showCancel = false,
  showDelete = true,
  onEdit,
  onCancel,
  onDelete
}: {
  lease: PropertyLeaseCardLease;
  title: string;
  tenantLabel?: ReactNode;
  showEdit?: boolean;
  showCancel?: boolean;
  showDelete?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const statusLabel = lease.displayStatus ?? lease.status ?? "";

  return (
    <article className="pg-lease-card pg-workspace-card">
      {showDelete && onDelete ? (
        <button
          type="button"
          className="pg-pfin-icon-btn pg-pfin-icon-btn--danger pg-lease-card__delete"
          aria-label="Delete lease permanently"
          title="Delete permanently"
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </button>
      ) : null}
      <header className="pg-lease-card__head">
        <h3 className="pg-lease-card__title">{title}</h3>
        {(showEdit && onEdit) || (showCancel && onCancel) ? (
          <div className="pg-pfin-row-actions">
            {showEdit && onEdit ? (
              <button type="button" className="pg-pfin-icon-btn" aria-label="Edit lease" title="Edit lease" onClick={onEdit}>
                <Pencil size={16} />
              </button>
            ) : null}
            {showCancel && onCancel ? (
              <button type="button" className="pg-pfin-icon-btn" aria-label="Cancel lease" title="Cancel lease" onClick={onCancel}>
                <XCircle size={16} />
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="pg-lease-card__body">
        {tenantLabel ? <div className="pg-muted" style={{ marginBottom: 6 }}>{tenantLabel}</div> : null}
        <div>
          <strong>{lease.leaseType}</strong> <span className="pg-muted">({statusLabel})</span>
        </div>
        <div className="pg-muted" style={{ marginTop: 4 }}>
          Start: {lease.startDate ? new Date(lease.startDate).toLocaleDateString() : "—"} | End:{" "}
          {lease.fixedTermEndDate ? new Date(lease.fixedTermEndDate).toLocaleDateString() : "Month-to-month"}
        </div>
        <div style={{ marginTop: 4 }}>
          Rent: R {Number(lease.monthlyRent ?? 0).toLocaleString()} | Deposit: R {Number(lease.depositAmount ?? 0).toLocaleString()}
        </div>
        <div className="pg-muted" style={{ marginTop: 4 }}>
          Rent due day: {lease.rentDueDay ?? "—"}
        </div>
      </div>
    </article>
  );
}

export function leaseTenantLabel(
  lease: PropertyLeaseCardLease,
  fallbackTenants?: Array<{ id?: string | number; firstName?: string; lastName?: string }>
): ReactNode {
  const tn = lease.tenant ?? fallbackTenants?.find((t) => String(t.id) === String(lease.tenantId));
  return (
    <>
      Tenant:{" "}
      {tn?.id ? (
        <Link className="pg-link" to={`/tenants/${tn.id}`}>
          {tn.firstName} {tn.lastName}
        </Link>
      ) : (
        <span className="pg-muted">Unknown</span>
      )}
    </>
  );
}
