import { Link } from "react-router-dom";
import { IconButton } from "../../../components/icons";
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
              <IconButton icon="edit" aria-label="Edit lease" variant="outline" onClick={onEdit} />
            ) : null}
            {showCancel && onCancel ? (
              <IconButton icon="leaseCancel" aria-label="Cancel lease" variant="outline" onClick={onCancel} />
            ) : null}
            {showDelete && onDelete ? (
              <IconButton icon="delete" aria-label="Delete lease permanently" variant="danger" onClick={onDelete} />
            ) : null}
            {onGenerateInvoice ? (
              <IconButton
                icon="invoices"
                aria-label="Generate invoice"
                variant="outline"
                disabled={!canGenerateInvoice}
                tooltip={canGenerateInvoice ? "Generate invoice" : "Only active leases can generate invoices"}
                onClick={onGenerateInvoice}
              />
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
