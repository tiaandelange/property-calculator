import {
  ProplyticAmountCell,
  ProplyticLeaseTermCell,
  ProplyticStatusBadge,
  ProplyticStatusBadgeGroup,
  ProplyticTable,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableEmptyState,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableWrap,
  ProplyticTenantCell,
  ProplyticTruncateCell
} from "../../../components/tables";
import { fmtZar, tenantInitialsFromName } from "../../leases/leaseDirectoryUtils";
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
            <ProplyticTableHeadCell columnType="text" columnPriority={1} sticky="start">
              Tenant
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="reference" columnPriority={3}>
              Reference
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency" columnPriority={1}>
              Monthly rent
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="date" columnPriority={2}>
              Lease term
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="compact" columnPriority={3}>
              Rent due
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency" columnPriority={3}>
              Deposit
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="status" columnPriority={1}>
              Status
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="actions" columnPriority={1} />
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {leases.map((lease) => {
            const leaseId = String(lease.id);
            const tenantName = leaseTenantDisplayName(lease, fallbackTenants);
            const tenantHref = leaseTenantHref(lease, fallbackTenants);
            const termLabel = leaseTermTypeLabel(lease);
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
                <ProplyticTableCell columnType="text" columnPriority={1} sticky="start">
                  <ProplyticTenantCell
                    name={tenantName}
                    sub={
                      coTenants.length > 0 ? (
                        <ProplyticTruncateCell title={coTenants.join(", ")}>
                          Co-tenants: {coTenants.join(", ")}
                        </ProplyticTruncateCell>
                      ) : undefined
                    }
                    href={tenantHref ?? undefined}
                    avatar={
                      <span className="pg-leases-avatar" aria-hidden>
                        {tenantInitialsFromName(tenantName)}
                      </span>
                    }
                  />
                </ProplyticTableCell>
                <ProplyticTableCell columnType="reference" columnPriority={3}>
                  <ProplyticTruncateCell>{leaseReferenceDisplay(lease)}</ProplyticTruncateCell>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="currency" columnPriority={1}>
                  {rent > 0 ? <ProplyticAmountCell>{fmtZar(rent)}</ProplyticAmountCell> : "—"}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="date" columnPriority={2}>
                  <ProplyticLeaseTermCell
                    start={lease.startDate != null ? String(lease.startDate) : null}
                    end={lease.fixedTermEndDate != null ? String(lease.fixedTermEndDate) : null}
                  />
                </ProplyticTableCell>
                <ProplyticTableCell columnType="compact" columnPriority={3}>
                  {rentDue != null && Number.isFinite(Number(rentDue)) ? `Day ${rentDue}` : "—"}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="currency" columnPriority={3}>
                  {deposit > 0 ? <ProplyticAmountCell>{fmtZar(deposit)}</ProplyticAmountCell> : "—"}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="status" columnPriority={1}>
                  <ProplyticStatusBadgeGroup>
                    <ProplyticStatusBadge status={lifecycle} />
                    <ProplyticStatusBadge status={lease.leaseType ?? "FIXED_TERM"} label={termLabel} />
                  </ProplyticStatusBadgeGroup>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="actions" columnPriority={1}>
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
