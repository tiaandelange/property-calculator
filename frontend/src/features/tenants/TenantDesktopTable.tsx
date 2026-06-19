import {
  ProplyticAmountCell,
  ProplyticLeaseTermCell,
  ProplyticPropertyCell,
  ProplyticStatusBadge,
  ProplyticTable,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableSkeleton,
  ProplyticTableWrap,
  ProplyticTenantCell,
  ProplyticTruncateCell
} from "../../components/tables";
import type { TenantListItem } from "./tenantDirectoryTypes";
import {
  fmtZar,
  tenantInitials,
  tenantRowContactEmail,
  tenantRowContactPhone,
  tenantRowDisplayName
} from "./tenantDirectoryUtils";
import { TenantRowActions } from "./TenantRowActions";
import { TenantLeaseStatusCell } from "./TenantLeaseStatusCell";

function TenantAvatar({ tenant }: { tenant: TenantListItem }) {
  return (
    <span className="pg-tenants-avatar" aria-hidden>
      {tenantInitials(tenant)}
    </span>
  );
}

function tenantPropertyAddress(t: TenantListItem): string {
  const parts = [t.propertyAddress, t.unitNumber ? `Unit ${t.unitNumber}` : ""].filter(Boolean);
  return parts.join(" · ");
}

export function TenantDesktopTable({
  items,
  loading,
  onDelete
}: {
  items: TenantListItem[];
  loading?: boolean;
  onDelete?: (tenant: TenantListItem) => void;
}) {
  if (loading) {
    return <ProplyticTableSkeleton rows={6} />;
  }

  if (!items.length) {
    return null;
  }

  return (
    <ProplyticTableWrap responsive>
      <ProplyticTable>
        <ProplyticTableHeader>
          <ProplyticTableRow>
            <ProplyticTableHeadCell columnType="text" columnPriority={1} sticky="start">
              Tenant
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text" columnPriority={2}>
              Property / Unit
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="reference" columnPriority={3}>
              Contact
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency" columnPriority={1}>
              Monthly Rent
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="date" columnPriority={2}>
              Lease Term
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="status" columnPriority={1}>
              Payment Status
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="status" columnPriority={2}>
              Lease Status
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="actions" columnPriority={1} />
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((t) => (
            <ProplyticTableRow key={t.id}>
              <ProplyticTableCell columnType="text" columnPriority={1} sticky="start">
                <ProplyticTenantCell
                  name={tenantRowDisplayName(t)}
                  sub={tenantRowContactEmail(t) || "No email"}
                  href={`/tenants/${t.id}`}
                  avatar={<TenantAvatar tenant={t} />}
                />
              </ProplyticTableCell>
              <ProplyticTableCell columnType="text" columnPriority={2}>
                <ProplyticPropertyCell
                  name={t.propertyName || "No property assigned"}
                  address={tenantPropertyAddress(t)}
                />
              </ProplyticTableCell>
              <ProplyticTableCell columnType="reference" columnPriority={3}>
                <ProplyticTruncateCell title={tenantRowContactPhone(t) || undefined}>
                  {tenantRowContactPhone(t) || "No phone"}
                </ProplyticTruncateCell>
              </ProplyticTableCell>
              <ProplyticTableCell columnType="currency" columnPriority={1}>
                {t.monthlyRent != null ? (
                  <ProplyticAmountCell>{fmtZar(t.monthlyRent)}</ProplyticAmountCell>
                ) : (
                  "—"
                )}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="date" columnPriority={2}>
                {t.leaseStartDate || t.leaseEndDate ? (
                  <ProplyticLeaseTermCell start={t.leaseStartDate} end={t.leaseEndDate} />
                ) : (
                  <span className="pg-ptable-muted">No active lease</span>
                )}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="status" columnPriority={1}>
                <ProplyticStatusBadge status={t.paymentStatus} />
              </ProplyticTableCell>
              <ProplyticTableCell columnType="status" columnPriority={2}>
                <TenantLeaseStatusCell tenant={t} useProplyticBadge />
              </ProplyticTableCell>
              <ProplyticTableCell columnType="actions" columnPriority={1}>
                <TenantRowActions tenant={t} onDelete={onDelete} />
              </ProplyticTableCell>
            </ProplyticTableRow>
          ))}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
