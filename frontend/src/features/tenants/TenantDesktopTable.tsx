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
import type { TenantListItem } from "./tenantDirectoryTypes";
import { fmtZar, formatDateShort, tenantInitials } from "./tenantDirectoryUtils";
import { TenantRowActions } from "./TenantRowActions";

function TenantAvatar({ tenant }: { tenant: TenantListItem }) {
  return (
    <span className="pg-tenants-avatar" aria-hidden>
      {tenantInitials(tenant)}
    </span>
  );
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
            <ProplyticTableHeadCell columnType="text">Tenant</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text">Property / Unit</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="reference">Contact</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency">Monthly Rent</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="date">Lease Term</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="status">Payment Status</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="status">Lease Status</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="actions" />
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((t) => (
            <ProplyticTableRow key={t.id}>
              <ProplyticTableCell columnType="text">
                <div className="pg-tenants-cell-tenant">
                  <TenantAvatar tenant={t} />
                  <div className="pg-tenants-cell-tenant-text">
                    <Link className="pg-tenants-name" to={`/tenants/${t.id}`}>
                      {t.fullName}
                    </Link>
                    <div className="pg-tenants-sub">{t.email?.trim() || "No email"}</div>
                  </div>
                </div>
              </ProplyticTableCell>
              <ProplyticTableCell columnType="text">
                <div className="pg-tenants-property">
                  <strong>{t.propertyName || "No property assigned"}</strong>
                  <div className="pg-tenants-sub">
                    {t.propertyAddress || "—"}
                    {t.unitNumber ? ` · Unit ${t.unitNumber}` : ""}
                  </div>
                </div>
              </ProplyticTableCell>
              <ProplyticTableCell columnType="reference">
                <div className="pg-tenants-contact">{t.phone?.trim() || "No phone"}</div>
              </ProplyticTableCell>
              <ProplyticTableCell columnType="currency">
                {t.monthlyRent != null ? (
                  <ProplyticAmountCell>{fmtZar(t.monthlyRent)}</ProplyticAmountCell>
                ) : (
                  "—"
                )}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="date">
                {t.leaseStartDate || t.leaseEndDate ? (
                  <div className="pg-tenants-term">
                    <div>{formatDateShort(t.leaseStartDate)}</div>
                    <div className="pg-tenants-sub">to {formatDateShort(t.leaseEndDate)}</div>
                  </div>
                ) : (
                  <span className="pg-tenants-sub">No active lease</span>
                )}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="status">
                <ProplyticStatusBadge status={t.paymentStatus} />
              </ProplyticTableCell>
              <ProplyticTableCell columnType="status">
                <ProplyticStatusBadge status={t.leaseStatus} />
              </ProplyticTableCell>
              <ProplyticTableCell columnType="actions">
                <TenantRowActions tenant={t} onDelete={onDelete} />
              </ProplyticTableCell>
            </ProplyticTableRow>
          ))}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
