import { Fragment, useCallback, useState } from "react";
import {
  ProplyticAmountCell,
  ProplyticLeaseTermCell,
  ProplyticPropertyCell,
  ProplyticStatusBadge,
  ProplyticStatusBadgeGroup,
  ProplyticTable,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableExpandToggle,
  ProplyticTableExpandedFields,
  ProplyticTableExpandedRow,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableSkeleton,
  ProplyticTableWrap,
  ProplyticTenantCell
} from "../../components/tables";
import type { LeaseListItem } from "./leaseDirectoryTypes";
import { fmtZar, tenantInitialsFromName } from "./leaseDirectoryUtils";
import { LeaseRowActions } from "./LeaseRowActions";

const LEASE_TABLE_COLS = 8;

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (loading) {
    return <ProplyticTableSkeleton rows={6} />;
  }

  if (!items.length) return null;

  return (
    <ProplyticTableWrap responsive>
      <ProplyticTable>
        <ProplyticTableHeader>
          <ProplyticTableRow>
            <ProplyticTableHeadCell columnType="text" columnPriority={1} sticky="start">
              Tenant
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text" columnPriority={2}>
              Property
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency" columnPriority={1}>
              Monthly Rent
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="date" columnPriority={2}>
              Lease Term
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="compact" columnPriority={3}>
              Rent Due
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
          {items.map((lease) => {
            const isExpanded = Boolean(expanded[lease.id]);
            return (
              <Fragment key={lease.id}>
                <ProplyticTableRow className="pg-ptable__row--with-expand">
                  <ProplyticTableCell columnType="text" columnPriority={1} sticky="start">
                    <div className="pg-ptable-row-leading">
                      <ProplyticTableExpandToggle
                        expanded={isExpanded}
                        onToggle={() => toggleExpanded(lease.id)}
                        label={`Show details for ${lease.tenantName}`}
                      />
                      <ProplyticTenantCell
                        name={lease.tenantName}
                        sub={lease.leaseTypeLabel}
                        href={lease.tenantId ? `/tenants/${lease.tenantId}` : undefined}
                        avatar={
                          <span className="pg-leases-avatar" aria-hidden>
                            {tenantInitialsFromName(lease.tenantName)}
                          </span>
                        }
                      />
                    </div>
                  </ProplyticTableCell>
                  <ProplyticTableCell columnType="text" columnPriority={2}>
                    <ProplyticPropertyCell
                      name={lease.propertyName}
                      address={lease.propertyAddress}
                      href={`/owned-properties/${lease.propertyId}`}
                    />
                  </ProplyticTableCell>
                  <ProplyticTableCell columnType="currency" columnPriority={1}>
                    {lease.monthlyRent != null ? (
                      <ProplyticAmountCell>{fmtZar(lease.monthlyRent)}</ProplyticAmountCell>
                    ) : (
                      "—"
                    )}
                  </ProplyticTableCell>
                  <ProplyticTableCell columnType="date" columnPriority={2}>
                    <ProplyticLeaseTermCell start={lease.startDate} end={lease.endDate} />
                  </ProplyticTableCell>
                  <ProplyticTableCell columnType="compact" columnPriority={3}>
                    {lease.rentDueDay != null ? `Day ${lease.rentDueDay}` : "—"}
                  </ProplyticTableCell>
                  <ProplyticTableCell columnType="currency" columnPriority={3}>
                    {lease.depositAmount != null ? (
                      <ProplyticAmountCell>{fmtZar(lease.depositAmount)}</ProplyticAmountCell>
                    ) : (
                      "—"
                    )}
                  </ProplyticTableCell>
                  <ProplyticTableCell columnType="status" columnPriority={1}>
                    <ProplyticStatusBadgeGroup>
                      <ProplyticStatusBadge status={lease.lifecycleStatus} />
                      <ProplyticStatusBadge status={lease.displayStatus} />
                    </ProplyticStatusBadgeGroup>
                  </ProplyticTableCell>
                  <ProplyticTableCell columnType="actions" columnPriority={1}>
                    <LeaseRowActions lease={lease} onCancel={onCancelLease} onDelete={onDeleteLease} />
                  </ProplyticTableCell>
                </ProplyticTableRow>
                <ProplyticTableExpandedRow colSpan={LEASE_TABLE_COLS} visible={isExpanded}>
                  <ProplyticTableExpandedFields
                    fields={[
                      { label: "Property", value: lease.propertyName },
                      { label: "Address", value: lease.propertyAddress || "—" },
                      { label: "Lease type", value: lease.leaseTypeLabel },
                      {
                        label: "Lease term",
                        value: (
                          <ProplyticLeaseTermCell start={lease.startDate} end={lease.endDate} />
                        )
                      },
                      {
                        label: "Rent due",
                        value: lease.rentDueDay != null ? `Day ${lease.rentDueDay}` : "—"
                      },
                      {
                        label: "Deposit",
                        value: lease.depositAmount != null ? fmtZar(lease.depositAmount) : "—"
                      }
                    ]}
                  />
                </ProplyticTableExpandedRow>
              </Fragment>
            );
          })}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
