import { Link } from "react-router-dom";
import {
  ProplyticAmountCell,
  ProplyticStatusBadge,
  ProplyticTable,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableEmptyState,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableWrap
} from "../../../components/tables";
import { fmtZar, formatDateShort, tenantInitialsFromName } from "../../leases/leaseDirectoryUtils";
import { deriveLeaseStatus } from "../../tenants/tenantDirectoryAdapter";
import type { PropertyLeaseCardLease } from "./PropertyLeaseCard";
import {
  leaseReferenceDisplay,
  leaseTermTypeLabel,
  leaseTenantDisplayName,
  leaseTenantHref
} from "./leaseCardDisplay";
import { PropertyLeaseRowActions } from "./PropertyLeaseRowActions";

export type PropertyLeaseTableRow = PropertyLeaseCardLease & {
  id: string | number;
  displayStatus?: string;
  status?: string;
};

export function PropertyLeasesTable({
  leases,
  fallbackTenants,
  highlightLeaseId,
  emptyMessage = "No leases to show.",
  showEdit = true,
  showCancel = false,
  showDelete = true,
  resolveShowEdit,
  resolveShowCancel,
  resolveShowDelete,
  canGenerateInvoiceForLease,
  onEdit,
  onCancel,
  onDelete,
  onGenerateInvoice
}: {
  leases: PropertyLeaseTableRow[];
  fallbackTenants?: Array<{ id?: string | number; firstName?: string; lastName?: string }>;
  highlightLeaseId?: string | null;
  emptyMessage?: string;
  showEdit?: boolean;
  showCancel?: boolean;
  showDelete?: boolean;
  resolveShowEdit?: (lease: PropertyLeaseTableRow) => boolean;
  resolveShowCancel?: (lease: PropertyLeaseTableRow) => boolean;
  resolveShowDelete?: (lease: PropertyLeaseTableRow) => boolean;
  canGenerateInvoiceForLease?: (lease: PropertyLeaseTableRow) => boolean;
  onEdit?: (lease: PropertyLeaseTableRow) => void;
  onCancel?: (lease: PropertyLeaseTableRow) => void;
  onDelete?: (lease: PropertyLeaseTableRow) => void;
  onGenerateInvoice?: (lease: PropertyLeaseTableRow) => void;
}) {
  if (!leases.length) {
    return <ProplyticTableEmptyState title={emptyMessage} />;
  }

  return (
    <ProplyticTableWrap responsive>
      <ProplyticTable>
        <ProplyticTableHeader>
          <ProplyticTableRow>
            <ProplyticTableHeadCell columnType="text">Tenant</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="reference">Reference</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency">Monthly rent</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="date">Lease term</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="compact">Rent due</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency">Deposit</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="status">Status</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="actions" />
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {leases.map((lease) => {
            const leaseId = String(lease.id);
            const tenantName = leaseTenantDisplayName(lease, fallbackTenants);
            const tenantHref = leaseTenantHref(lease, fallbackTenants);
            const termLabel = leaseTermTypeLabel(lease);
            const displayStatus = String(lease.displayStatus ?? lease.status ?? "");
            const lifecycle = deriveLeaseStatus(
              {
                id: leaseId,
                tenantId: String(lease.tenantId ?? ""),
                propertyId: "",
                startDate: lease.startDate != null ? String(lease.startDate) : null,
                fixedTermEndDate: lease.fixedTermEndDate != null ? String(lease.fixedTermEndDate) : null,
                status: lease.status != null ? String(lease.status) : null
              },
              new Date()
            );
            const highlighted = highlightLeaseId === leaseId;
            const rent = Number(lease.monthlyRent ?? 0);
            const deposit = Number(lease.depositAmount ?? 0);
            const rentDue = lease.rentDueDay;
            const canInvoice = canGenerateInvoiceForLease?.(lease) ?? false;
            const rowShowEdit = resolveShowEdit ? resolveShowEdit(lease) : showEdit;
            const rowShowCancel = resolveShowCancel ? resolveShowCancel(lease) : showCancel;
            const rowShowDelete = resolveShowDelete ? resolveShowDelete(lease) : showDelete;
            const coTenants =
              lease.leaseTenants
                ?.filter((lt) => !lt.isPrimary && lt.tenant)
                .map((lt) => `${lt.tenant?.firstName ?? ""} ${lt.tenant?.lastName ?? ""}`.trim())
                .filter(Boolean) ?? [];

            return (
              <ProplyticTableRow
                key={leaseId}
                id={`lease-row-${leaseId}`}
                className={highlighted ? "pg-ptable__row--highlighted" : undefined}
              >
                <ProplyticTableCell columnType="text">
                  <div className="pg-leases-cell-tenant">
                    <span className="pg-leases-avatar" aria-hidden>
                      {tenantInitialsFromName(tenantName)}
                    </span>
                    <div className="pg-leases-cell-tenant-text">
                      {tenantHref ? (
                        <Link className="pg-leases-name" to={tenantHref}>
                          {tenantName}
                        </Link>
                      ) : (
                        <span className="pg-leases-name">{tenantName}</span>
                      )}
                      <div className="pg-leases-sub">{termLabel}</div>
                      {coTenants.length > 0 ? (
                        <div className="pg-leases-sub">Co-tenants: {coTenants.join(", ")}</div>
                      ) : null}
                    </div>
                  </div>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="reference">{leaseReferenceDisplay(lease)}</ProplyticTableCell>
                <ProplyticTableCell columnType="currency">
                  {rent > 0 ? <ProplyticAmountCell>{fmtZar(rent)}</ProplyticAmountCell> : "—"}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="date">
                  {lease.startDate || lease.fixedTermEndDate ? (
                    <div className="pg-leases-term">
                      <div>{formatDateShort(lease.startDate != null ? String(lease.startDate) : null)}</div>
                      <div className="pg-leases-sub">
                        to{" "}
                        {lease.fixedTermEndDate
                          ? formatDateShort(String(lease.fixedTermEndDate))
                          : "Month-to-month"}
                      </div>
                    </div>
                  ) : (
                    <span className="pg-leases-sub">—</span>
                  )}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="compact">
                  <div className="pg-leases-due">
                    {rentDue != null && Number.isFinite(Number(rentDue)) ? `Day ${rentDue}` : "—"}
                  </div>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="currency">
                  {deposit > 0 ? <ProplyticAmountCell>{fmtZar(deposit)}</ProplyticAmountCell> : "—"}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="status">
                  <div className="pg-leases-status-stack">
                    <ProplyticStatusBadge status={lifecycle} />
                    {displayStatus ? <ProplyticStatusBadge status={displayStatus} /> : null}
                  </div>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="actions">
                  <PropertyLeaseRowActions
                    leaseId={leaseId}
                    tenantId={lease.tenantId}
                    showEdit={rowShowEdit}
                    showCancel={rowShowCancel}
                    showDelete={rowShowDelete}
                    canGenerateInvoice={canInvoice}
                    onEdit={onEdit ? () => onEdit(lease) : undefined}
                    onCancel={onCancel ? () => onCancel(lease) : undefined}
                    onDelete={onDelete ? () => onDelete(lease) : undefined}
                    onGenerateInvoice={onGenerateInvoice ? () => onGenerateInvoice(lease) : undefined}
                  />
                </ProplyticTableCell>
              </ProplyticTableRow>
            );
          })}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
