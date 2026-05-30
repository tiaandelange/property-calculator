import { Link } from "react-router-dom";
import {
  ProplyticAmountCell,
  ProplyticStatusBadge,
  ProplyticTable,
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
            <ProplyticTableHeadCell columnType="text">Tenant</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text">Property</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency">Monthly Rent</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="date">Lease Term</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="compact">Rent Due</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency">Deposit</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="status">Status</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="actions" />
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((lease) => (
            <ProplyticTableRow key={lease.id}>
              <ProplyticTableCell columnType="text">
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
              <ProplyticTableCell columnType="text">
                <div className="pg-leases-property">
                  <Link className="pg-leases-name" to={`/owned-properties/${lease.propertyId}`}>
                    <strong>{lease.propertyName}</strong>
                  </Link>
                  <div className="pg-leases-sub">{lease.propertyAddress || "—"}</div>
                </div>
              </ProplyticTableCell>
              <ProplyticTableCell columnType="currency">
                {lease.monthlyRent != null ? (
                  <ProplyticAmountCell>{fmtZar(lease.monthlyRent)}</ProplyticAmountCell>
                ) : (
                  "—"
                )}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="date">
                {lease.startDate || lease.endDate ? (
                  <div className="pg-leases-term">
                    <div>{formatDateShort(lease.startDate)}</div>
                    <div className="pg-leases-sub">to {formatDateShort(lease.endDate)}</div>
                  </div>
                ) : (
                  <span className="pg-leases-sub">—</span>
                )}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="compact">
                <div className="pg-leases-due">{lease.rentDueDay != null ? `Day ${lease.rentDueDay}` : "—"}</div>
              </ProplyticTableCell>
              <ProplyticTableCell columnType="currency">
                {lease.depositAmount != null ? (
                  <ProplyticAmountCell>{fmtZar(lease.depositAmount)}</ProplyticAmountCell>
                ) : (
                  "—"
                )}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="status">
                <div className="pg-leases-status-stack">
                  <ProplyticStatusBadge status={lease.lifecycleStatus} />
                  <ProplyticStatusBadge status={lease.displayStatus} />
                </div>
              </ProplyticTableCell>
              <ProplyticTableCell columnType="actions">
                <LeaseRowActions lease={lease} onCancel={onCancelLease} onDelete={onDeleteLease} />
              </ProplyticTableCell>
            </ProplyticTableRow>
          ))}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
