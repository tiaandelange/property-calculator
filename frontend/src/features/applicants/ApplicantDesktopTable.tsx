import {
  ProplyticAmountCell,
  ProplyticMobileRowCard,
  ProplyticMobileRowList,
  ProplyticTable,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableSkeleton,
  ProplyticTableWrap,
  ProplyticTableRowActionsMenu
} from "../../components/tables";
import { useMediaQuery } from "../../hooks/useMediaQuery";
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
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (loading) {
    return <ProplyticTableSkeleton rows={6} />;
  }

  if (!items.length) {
    return null;
  }

  if (isMobile) {
    return (
      <ProplyticMobileRowList>
        {items.map((item) => (
          <li key={item.id}>
            <ProplyticMobileRowCard
              title={item.fullName}
              subtitle={item.email?.trim() || "No email"}
              badge={item.fitScore != null ? <ApplicantFitBadge score={item.fitScore} /> : undefined}
              fields={[
                { label: "Phone", value: item.phone?.trim() || "—" },
                {
                  label: "Monthly income",
                  value: item.monthlyIncome != null ? fmtZar(item.monthlyIncome) : "—"
                },
                { label: "Property", value: item.propertyName || "—" }
              ]}
              actions={
                <ProplyticTableRowActionsMenu
                  actions={[
                    {
                      key: "view",
                      label: "View applicant",
                      icon: "view",
                      onClick: () => onView(item),
                      primary: true
                    },
                    {
                      key: "delete",
                      label: "Delete applicant",
                      icon: "delete",
                      onClick: () => onDelete(item),
                      destructive: true
                    }
                  ]}
                />
              }
            />
          </li>
        ))}
      </ProplyticMobileRowList>
    );
  }

  return (
    <ProplyticTableWrap responsive>
      <ProplyticTable>
        <ProplyticTableHeader>
          <ProplyticTableRow>
            <ProplyticTableHeadCell columnType="text">Applicant</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text">Email</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency">Monthly income</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="status">Fit profile</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text">Property</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="actions" />
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((item) => (
            <ProplyticTableRow key={item.id}>
              <ProplyticTableCell columnType="text">
                <div className="pg-ptable-desc">
                  <div className="pg-ptable-desc__main">{item.fullName}</div>
                  {item.phone ? <div className="pg-ptable-desc__sub pg-muted">{item.phone}</div> : null}
                </div>
              </ProplyticTableCell>
              <ProplyticTableCell columnType="text">
                <span className="pg-ptable-desc__main">{item.email?.trim() || "—"}</span>
              </ProplyticTableCell>
              <ProplyticTableCell columnType="currency">
                {item.monthlyIncome != null ? (
                  <ProplyticAmountCell>{fmtZar(item.monthlyIncome)}</ProplyticAmountCell>
                ) : (
                  "—"
                )}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="status">
                {item.fitScore != null ? <ApplicantFitBadge score={item.fitScore} /> : "—"}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="text">{item.propertyName || "—"}</ProplyticTableCell>
              <ProplyticTableCell columnType="actions">
                <ProplyticTableRowActionsMenu
                  actions={[
                    {
                      key: "view",
                      label: "View applicant",
                      icon: "view",
                      onClick: () => onView(item),
                      primary: true
                    },
                    {
                      key: "delete",
                      label: "Delete applicant",
                      icon: "delete",
                      onClick: () => onDelete(item),
                      destructive: true
                    }
                  ]}
                />
              </ProplyticTableCell>
            </ProplyticTableRow>
          ))}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
