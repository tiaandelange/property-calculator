import {
  ProplyticAmountCell,
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
import { IconButton } from "../../components/icons";
import type { TenantListItem } from "../tenants/tenantDirectoryTypes";
import { fmtZar } from "../tenants/tenantDirectoryUtils";

function fitTone(score: number): "success" | "warning" | "danger" {
  if (score >= 100) return "success";
  if (score >= 70) return "warning";
  return "danger";
}

function ApplicantFitBadge({ score }: { score: number }) {
  const tone = fitTone(score);
  return (
    <span className={`pg-applicant-fit pg-applicant-fit--${tone}`} title="Affordability vs 3× monthly rent">
      {Math.round(score)}%
    </span>
  );
}

export function ApplicantDesktopTable({
  items,
  loading,
  onView,
  onDelete
}: {
  items: TenantListItem[];
  loading?: boolean;
  onView: (item: TenantListItem) => void;
  onDelete: (item: TenantListItem) => void;
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
            <ProplyticTableHeadCell>Applicant</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Email</ProplyticTableHeadCell>
            <ProplyticTableHeadCell numeric>Monthly income</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Fit profile</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Property</ProplyticTableHeadCell>
            <ProplyticTableHeadCell actions>
              <span className="pg-ptable-sr-only">Actions</span>
            </ProplyticTableHeadCell>
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((item) => (
            <ProplyticTableRow key={item.id}>
              <ProplyticTableCell>
                <div className="pg-ptable-desc">
                  <div className="pg-ptable-desc__main">{item.fullName}</div>
                  {item.phone ? <div className="pg-ptable-desc__sub">{item.phone}</div> : null}
                </div>
              </ProplyticTableCell>
              <ProplyticTableCell>{item.email?.trim() || "—"}</ProplyticTableCell>
              <ProplyticTableCell numeric>
                {item.monthlyIncome != null ? (
                  <ProplyticAmountCell>{fmtZar(item.monthlyIncome)}</ProplyticAmountCell>
                ) : (
                  "—"
                )}
              </ProplyticTableCell>
              <ProplyticTableCell>
                {item.fitScore != null ? <ApplicantFitBadge score={item.fitScore} /> : "—"}
              </ProplyticTableCell>
              <ProplyticTableCell>{item.propertyName || "—"}</ProplyticTableCell>
              <ProplyticTableCell actions>
                <ProplyticTableActions>
                  <IconButton
                    icon="view"
                    aria-label={`View ${item.fullName}`}
                    variant="outline"
                    onClick={() => onView(item)}
                  />
                  <IconButton
                    icon="delete"
                    aria-label={`Delete ${item.fullName}`}
                    variant="danger-outline"
                    onClick={() => onDelete(item)}
                  />
                </ProplyticTableActions>
              </ProplyticTableCell>
            </ProplyticTableRow>
          ))}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
