import { Link } from "react-router-dom";
import {
  ProplyticAmountCell,
  ProplyticDescriptionCell,
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
  ProplyticTableRowActionsMenu,
  type ProplyticTableRowAction
} from "../../components/tables";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { invoiceStatementCreditClass, invoiceStatementDisplayType } from "../invoices/invoiceStatementUtils";
import { invoiceDetailPath } from "../invoices/invoiceRoutes";
import type { FinancialStatementRow } from "./financialDirectoryTypes";
import { fmtZar, propertyFinancialsStatementUrl } from "./financialDirectoryUtils";

function finSubForSource(source: string): "statement" | "invoice" | "expenses" {
  if (source === "INVOICE") return "invoice";
  if (source === "EXPENSE") return "expenses";
  return "statement";
}

function creditTone(row: FinancialStatementRow): "credit-paid" | "credit-due" | "credit-overdue" | "neutral" {
  if (row.source !== "INVOICE") return "neutral";
  const cls = invoiceStatementCreditClass(row.status);
  if (cls.includes("paid")) return "credit-paid";
  if (cls.includes("overdue") || cls.includes("danger")) return "credit-overdue";
  if (cls.includes("due") || cls.includes("warning")) return "credit-due";
  return "neutral";
}

function rowActionsFor(r: FinancialStatementRow): ProplyticTableRowAction[] {
  const manageUrl = propertyFinancialsStatementUrl(r.propertyId, finSubForSource(r.source));
  const invoiceViewUrl = r.source === "INVOICE" && r.invoiceId ? invoiceDetailPath(r.invoiceId) : null;
  const rowActions: ProplyticTableRowAction[] = [];

  if (r.source !== "INVOICE") {
    rowActions.push({
      key: "edit",
      label: "Edit entry",
      icon: "edit",
      href: manageUrl,
      primary: true
    });
  }

  if (invoiceViewUrl) {
    rowActions.push({
      key: "view",
      label: "View invoice",
      icon: "edit",
      href: invoiceViewUrl,
      primary: r.source === "INVOICE"
    });
  }

  return rowActions;
}

function displayType(row: FinancialStatementRow): string {
  return row.source === "INVOICE"
    ? invoiceStatementDisplayType(row as unknown as Record<string, unknown>)
    : row.type;
}

export function FinancialStatementTable({
  items,
  loading,
  showRunningBalance
}: {
  items: FinancialStatementRow[];
  loading?: boolean;
  showRunningBalance: boolean;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (loading) {
    return <ProplyticTableSkeleton rows={8} />;
  }

  if (!items.length) return null;

  if (isMobile) {
    return (
      <ProplyticMobileRowList>
        {items.map((r) => {
          const typeLabel = displayType(r);
          const fields = [
            { label: "Property", value: r.propertyName },
            { label: "Type", value: typeLabel },
            {
              label: "Debit",
              value: r.debit != null ? fmtZar(r.debit) : "—"
            },
            {
              label: "Credit",
              value: r.credit != null ? fmtZar(r.credit) : "—"
            },
            { label: "Source", value: r.source }
          ];

          if (showRunningBalance) {
            fields.splice(4, 0, {
              label: "Balance",
              value: r.balance != null ? fmtZar(r.balance) : "—"
            });
          }

          if (r.invoiceNumber) {
            fields.splice(2, 0, { label: "Invoice", value: r.invoiceNumber });
          }

          return (
            <li key={r.id}>
              <ProplyticMobileRowCard
                title={r.description}
                subtitle={r.date}
                badge={
                  r.credit != null ? (
                    <ProplyticAmountCell tone={creditTone(r)}>{fmtZar(r.credit)}</ProplyticAmountCell>
                  ) : r.debit != null ? (
                    <ProplyticAmountCell tone="debit">{fmtZar(r.debit)}</ProplyticAmountCell>
                  ) : null
                }
                fields={fields}
                actions={<ProplyticTableRowActionsMenu actions={rowActionsFor(r)} />}
              />
            </li>
          );
        })}
      </ProplyticMobileRowList>
    );
  }

  return (
    <ProplyticTableWrap responsive>
      <ProplyticTable variant="financial" className="pg-fins-statement-table">
        <ProplyticTableHeader>
          <ProplyticTableRow>
            <ProplyticTableHeadCell columnType="date" columnPriority={1} sticky="start">
              Date
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text" columnPriority={2}>
              Property
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="description" columnPriority={1}>
              Description
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="reference" columnPriority={3}>
              Type
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency" columnPriority={1}>
              Debit
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency" columnPriority={1}>
              Credit
            </ProplyticTableHeadCell>
            {showRunningBalance ? (
              <ProplyticTableHeadCell columnType="currency" columnPriority={2}>
                Balance
              </ProplyticTableHeadCell>
            ) : null}
            <ProplyticTableHeadCell columnType="reference" columnPriority={4}>
              Source
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="actions" columnPriority={1} />
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((r) => (
            <ProplyticTableRow key={r.id}>
              <ProplyticTableCell columnType="date" columnPriority={1} sticky="start">
                {r.date}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="text" columnPriority={2}>
                <Link className="pg-fins-name" to={`/owned-properties/${r.propertyId}?tab=financials&fin=statement`}>
                  {r.propertyName}
                </Link>
              </ProplyticTableCell>
              <ProplyticTableCell columnType="description" columnPriority={1}>
                <ProplyticDescriptionCell
                  main={r.description}
                  sub={r.invoiceNumber ? `Invoice ${r.invoiceNumber}` : undefined}
                  title={r.description}
                />
              </ProplyticTableCell>
              <ProplyticTableCell columnType="reference" columnPriority={3}>
                {displayType(r)}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="currency" columnPriority={1}>
                {r.debit != null ? <ProplyticAmountCell tone="debit">{fmtZar(r.debit)}</ProplyticAmountCell> : "—"}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="currency" columnPriority={1}>
                {r.credit != null ? (
                  <ProplyticAmountCell tone={creditTone(r)}>{fmtZar(r.credit)}</ProplyticAmountCell>
                ) : (
                  "—"
                )}
              </ProplyticTableCell>
              {showRunningBalance ? (
                <ProplyticTableCell columnType="currency" columnPriority={2}>
                  {r.balance != null ? <ProplyticAmountCell tone="balance">{fmtZar(r.balance)}</ProplyticAmountCell> : "—"}
                </ProplyticTableCell>
              ) : null}
              <ProplyticTableCell columnType="reference" columnPriority={4}>
                {r.source}
              </ProplyticTableCell>
              <ProplyticTableCell columnType="actions" columnPriority={1}>
                <ProplyticTableRowActionsMenu actions={rowActionsFor(r)} />
              </ProplyticTableCell>
            </ProplyticTableRow>
          ))}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
