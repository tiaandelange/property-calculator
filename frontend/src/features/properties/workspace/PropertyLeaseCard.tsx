import { Pencil, ReceiptText, Trash2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatLeaseCardDate,
  leaseCardStatusTags,
  leaseReferenceDisplay,
  leaseTermTypeLabel,
  leaseTenantDisplayName,
  leaseTenantHref,
  rentDueDayLabel,
  type LeaseCardLeaseInput
} from "./leaseCardDisplay";

export type PropertyLeaseCardLease = LeaseCardLeaseInput & {
  monthlyRent?: number;
  depositAmount?: number;
  leaseTenants?: Array<{
    tenantId?: string;
    isPrimary?: boolean;
    role?: string;
    tenant?: { id?: string; firstName?: string; lastName?: string };
  }>;
};

export function PropertyLeaseCard({
  lease,
  fallbackTenants,
  showEdit = true,
  showCancel = false,
  showDelete = true,
  highlighted = false,
  cardId,
  canGenerateInvoice = false,
  onEdit,
  onCancel,
  onDelete,
  onGenerateInvoice
}: {
  lease: PropertyLeaseCardLease;
  fallbackTenants?: Array<{ id?: string | number; firstName?: string; lastName?: string }>;
  showEdit?: boolean;
  showCancel?: boolean;
  showDelete?: boolean;
  highlighted?: boolean;
  cardId?: string;
  canGenerateInvoice?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onGenerateInvoice?: () => void;
}) {
  const tenantName = leaseTenantDisplayName(lease, fallbackTenants);
  const tenantHref = leaseTenantHref(lease, fallbackTenants);
  const termLabel = leaseTermTypeLabel(lease);
  const tags = leaseCardStatusTags(lease);
  const coTenants =
    lease.leaseTenants
      ?.filter((lt) => !lt.isPrimary && lt.tenant)
      .map((lt) => `${lt.tenant?.firstName ?? ""} ${lt.tenant?.lastName ?? ""}`.trim())
      .filter(Boolean) ?? [];

  const hasActions =
    (showEdit && onEdit) || (showCancel && onCancel) || (showDelete && onDelete) || Boolean(onGenerateInvoice);

  return (
    <article
      id={cardId}
      className={`pg-lease-card pg-workspace-card${highlighted ? " pg-lease-card--highlighted" : ""}`}
    >
      <header className="pg-lease-card__head">
        <div className="pg-lease-card__primary">
          <h3 className="pg-lease-card__title">
            {tenantHref ? (
              <Link className="pg-link" to={tenantHref}>
                {tenantName}
              </Link>
            ) : (
              tenantName
            )}
          </h3>
          <p className="pg-lease-card__term">{termLabel}</p>
          <dl className="pg-lease-card__meta">
            <div className="pg-lease-card__meta-row">
              <dt>Start date</dt>
              <dd>{formatLeaseCardDate(lease.startDate)}</dd>
            </div>
            <div className="pg-lease-card__meta-row">
              <dt>End date</dt>
              <dd>
                {lease.fixedTermEndDate
                  ? formatLeaseCardDate(lease.fixedTermEndDate)
                  : "Month-to-month (no fixed end)"}
              </dd>
            </div>
            <div className="pg-lease-card__meta-row">
              <dt>Rent</dt>
              <dd>
                R {Number(lease.monthlyRent ?? 0).toLocaleString()}/mo · Deposit R{" "}
                {Number(lease.depositAmount ?? 0).toLocaleString()}
              </dd>
            </div>
            <div className="pg-lease-card__meta-row">
              <dt>Rent due</dt>
              <dd>{rentDueDayLabel(lease.rentDueDay)}</dd>
            </div>
            <div className="pg-lease-card__meta-row">
              <dt>Lease reference</dt>
              <dd>{leaseReferenceDisplay(lease)}</dd>
            </div>
          </dl>
          {coTenants.length > 0 ? (
            <p className="pg-muted pg-lease-card__cotenants">
              Co-tenants: {coTenants.join(", ")}
            </p>
          ) : null}
        </div>
        {hasActions ? (
          <div className="pg-pfin-row-actions pg-lease-card__actions">
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
            {showDelete && onDelete ? (
              <button
                type="button"
                className="pg-pfin-icon-btn pg-pfin-icon-btn--danger"
                aria-label="Delete lease permanently"
                title="Delete permanently"
                onClick={onDelete}
              >
                <Trash2 size={16} />
              </button>
            ) : null}
            {onGenerateInvoice ? (
              <button
                type="button"
                className="pg-pfin-icon-btn"
                aria-label="Generate invoice"
                title={canGenerateInvoice ? "Generate invoice" : "Only active leases can generate invoices"}
                disabled={!canGenerateInvoice}
                onClick={onGenerateInvoice}
              >
                <ReceiptText size={16} />
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      {tags.length > 0 ? (
        <footer className="pg-lease-card__tags">
          {tags.map((tag) => (
            <span key={tag.label} className={tag.badgeClass}>
              {tag.label}
            </span>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

export function leaseTenantLabel(
  lease: PropertyLeaseCardLease,
  fallbackTenants?: Array<{ id?: string | number; firstName?: string; lastName?: string }>
) {
  const name = leaseTenantDisplayName(lease, fallbackTenants);
  const href = leaseTenantHref(lease, fallbackTenants);
  return (
    <>
      Tenant:{" "}
      {href ? (
        <Link className="pg-link" to={href}>
          {name}
        </Link>
      ) : (
        <span className="pg-muted">{name}</span>
      )}
    </>
  );
}
