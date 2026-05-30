import { Link } from "react-router-dom";
import {
  ProplyticAmountCell,
  ProplyticDescriptionCell,
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

export function FinancialStatementTable({
  items,
  loading,
  showRunningBalance
}: {
  items: FinancialStatementRow[];
  loading?: boolean;
  showRunningBalance: boolean;
}) {
  if (loading) {
    return <ProplyticTableSkeleton rows={8} />;
  }

  if (!items.length) return null;

  return (
    <ProplyticTableWrap responsive>
      <ProplyticTable variant="financial" className="pg-fins-statement-table">
        <ProplyticTableHeader>
          <ProplyticTableRow>
            <ProplyticTableHeadCell columnType="date">Date</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text">Property</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="description">Description</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="reference">Type</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency">Debit</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency">Credit</ProplyticTableHeadCell>
            {showRunningBalance ? <ProplyticTableHeadCell columnType="currency">Balance</ProplyticTableHeadCell> : null}
            <ProplyticTableHeadCell columnType="reference">Source</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="actions" />
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((r) => {
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

            return (
              <ProplyticTableRow key={r.id}>
                <ProplyticTableCell columnType="date">{r.date}</ProplyticTableCell>
                <ProplyticTableCell columnType="text">
                  <Link className="pg-fins-name" to={`/owned-properties/${r.propertyId}?tab=financials&fin=statement`}>
                    {r.propertyName}
                  </Link>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="description">
                  <ProplyticDescriptionCell
                    main={r.description}
                    sub={r.invoiceNumber ? `Invoice ${r.invoiceNumber}` : undefined}
                    title={r.description}
                  />
                </ProplyticTableCell>
                <ProplyticTableCell columnType="reference">
                  {r.source === "INVOICE"
                    ? invoiceStatementDisplayType(r as unknown as Record<string, unknown>)
                    : r.type}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="currency">
                  {r.debit != null ? <ProplyticAmountCell tone="debit">{fmtZar(r.debit)}</ProplyticAmountCell> : "—"}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="currency">
                  {r.credit != null ? (
                    <ProplyticAmountCell tone={creditTone(r)}>{fmtZar(r.credit)}</ProplyticAmountCell>
                  ) : (
                    "—"
                  )}
                </ProplyticTableCell>
                {showRunningBalance ? (
                  <ProplyticTableCell columnType="currency">
                    {r.balance != null ? <ProplyticAmountCell tone="balance">{fmtZar(r.balance)}</ProplyticAmountCell> : "—"}
                  </ProplyticTableCell>
                ) : null}
                <ProplyticTableCell columnType="reference">{r.source}</ProplyticTableCell>
                <ProplyticTableCell columnType="actions">
                  <ProplyticTableRowActionsMenu actions={rowActions} />
                </ProplyticTableCell>
              </ProplyticTableRow>
            );
          })}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
