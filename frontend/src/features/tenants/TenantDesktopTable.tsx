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
  loading
}: {
  items: TenantListItem[];
  loading?: boolean;
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
            <ProplyticTableHeadCell>Tenant</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Property / Unit</ProplyticTableHeadCell>
            <ProplyticTableHeadCell compact>Contact</ProplyticTableHeadCell>
            <ProplyticTableHeadCell numeric>Monthly Rent</ProplyticTableHeadCell>
            <ProplyticTableHeadCell compact>Lease Term</ProplyticTableHeadCell>
            <ProplyticTableHeadCell compact>Payment Status</ProplyticTableHeadCell>
            <ProplyticTableHeadCell compact>Lease Status</ProplyticTableHeadCell>
            <ProplyticTableHeadCell actions>
              <span className="pg-ptable-sr-only">Actions</span>
            </ProplyticTableHeadCell>
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((t) => (
            <ProplyticTableRow key={t.id}>
              <ProplyticTableCell>
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
              <ProplyticTableCell>
                <div className="pg-tenants-property">
                  <strong>{t.propertyName || "No property assigned"}</strong>
                  <div className="pg-tenants-sub">
                    {t.propertyAddress || "—"}
                    {t.unitNumber ? ` · Unit ${t.unitNumber}` : ""}
                  </div>
                </div>
              </ProplyticTableCell>
              <ProplyticTableCell compact>
                <div className="pg-tenants-contact">{t.phone?.trim() || "No phone"}</div>
              </ProplyticTableCell>
              <ProplyticTableCell numeric>
                {t.monthlyRent != null ? (
                  <ProplyticAmountCell>{fmtZar(t.monthlyRent)}</ProplyticAmountCell>
                ) : (
                  "—"
                )}
              </ProplyticTableCell>
              <ProplyticTableCell compact>
                {t.leaseStartDate || t.leaseEndDate ? (
                  <div className="pg-tenants-term">
                    <div>{formatDateShort(t.leaseStartDate)}</div>
                    <div className="pg-tenants-sub">to {formatDateShort(t.leaseEndDate)}</div>
                  </div>
                ) : (
                  <span className="pg-tenants-sub">No active lease</span>
                )}
              </ProplyticTableCell>
              <ProplyticTableCell compact>
                <ProplyticStatusBadge status={t.paymentStatus} />
              </ProplyticTableCell>
              <ProplyticTableCell compact>
                <ProplyticStatusBadge status={t.leaseStatus} />
              </ProplyticTableCell>
              <ProplyticTableCell actions>
                <TenantRowActions tenant={t} />
              </ProplyticTableCell>
            </ProplyticTableRow>
          ))}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
