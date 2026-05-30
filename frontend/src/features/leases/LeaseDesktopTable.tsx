import { Link } from "react-router-dom";
import {
  ProplyticAmountCell,
  ProplyticStatusBadge,
  ProplyticTable,
  ProplyticTableActions,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableSkeleton,
  ProplyticTableWrap
} from "../../components/tables";
import type { LeaseListItem } from "./leaseDirectoryTypes";
import { fmtZar, formatDateShort, tenantInitialsFromName } from "./leaseDirectoryUtils";
import { LeaseRowActions } from "./LeaseRowActions";

export function LeaseDesktopTable({
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
    return <ProplyticTableSkeleton rows={6} />;
  }

  if (!items.length) return null;

  return (
    <ProplyticTableWrap responsive>
      <ProplyticTable>
        <ProplyticTableHeader>
          <ProplyticTableRow>
            <ProplyticTableHeadCell>Tenant</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Property</ProplyticTableHeadCell>
            <ProplyticTableHeadCell numeric>Monthly Rent</ProplyticTableHeadCell>
            <ProplyticTableHeadCell compact>Lease Term</ProplyticTableHeadCell>
            <ProplyticTableHeadCell compact>Rent Due</ProplyticTableHeadCell>
            <ProplyticTableHeadCell numeric>Deposit</ProplyticTableHeadCell>
            <ProplyticTableHeadCell compact>Status</ProplyticTableHeadCell>
            <ProplyticTableHeadCell actions>
              <span className="pg-ptable-sr-only">Actions</span>
            </ProplyticTableHeadCell>
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((lease) => (
            <ProplyticTableRow key={lease.id}>
              <ProplyticTableCell>
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
              </ProplyticTableCell>
              <ProplyticTableCell>
                <div className="pg-leases-property">
                  <Link className="pg-leases-name" to={`/owned-properties/${lease.propertyId}`}>
                    <strong>{lease.propertyName}</strong>
                  </Link>
                  <div className="pg-leases-sub">{lease.propertyAddress || "—"}</div>
                </div>
              </ProplyticTableCell>
              <ProplyticTableCell numeric>
                {lease.monthlyRent != null ? (
                  <ProplyticAmountCell>{fmtZar(lease.monthlyRent)}</ProplyticAmountCell>
                ) : (
                  "—"
                )}
              </ProplyticTableCell>
              <ProplyticTableCell compact>
                {lease.startDate || lease.endDate ? (
                  <div className="pg-leases-term">
                    <div>{formatDateShort(lease.startDate)}</div>
                    <div className="pg-leases-sub">to {formatDateShort(lease.endDate)}</div>
                  </div>
                ) : (
                  <span className="pg-leases-sub">—</span>
                )}
              </ProplyticTableCell>
              <ProplyticTableCell compact>
                <div className="pg-leases-due">{lease.rentDueDay != null ? `Day ${lease.rentDueDay}` : "—"}</div>
              </ProplyticTableCell>
              <ProplyticTableCell numeric>
                {lease.depositAmount != null ? (
                  <ProplyticAmountCell>{fmtZar(lease.depositAmount)}</ProplyticAmountCell>
                ) : (
                  "—"
                )}
              </ProplyticTableCell>
              <ProplyticTableCell compact>
                <div className="pg-leases-status-stack">
                  <ProplyticStatusBadge status={lease.lifecycleStatus} />
                  <ProplyticStatusBadge status={lease.displayStatus} />
                </div>
              </ProplyticTableCell>
              <ProplyticTableCell actions>
                <LeaseRowActions lease={lease} onCancel={onCancelLease} onDelete={onDeleteLease} />
              </ProplyticTableCell>
            </ProplyticTableRow>
          ))}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
