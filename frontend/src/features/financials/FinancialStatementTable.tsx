import { Link } from "react-router-dom";
import { IconButton } from "../../components/icons";
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
            <ProplyticTableHeadCell>Date</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Property</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Description</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Type</ProplyticTableHeadCell>
            <ProplyticTableHeadCell numeric>Debit</ProplyticTableHeadCell>
            <ProplyticTableHeadCell numeric>Credit</ProplyticTableHeadCell>
            {showRunningBalance ? <ProplyticTableHeadCell numeric>Balance</ProplyticTableHeadCell> : null}
            <ProplyticTableHeadCell>Source</ProplyticTableHeadCell>
            <ProplyticTableHeadCell actions>
              <span className="pg-ptable-sr-only">Actions</span>
            </ProplyticTableHeadCell>
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((r) => {
            const manageUrl = propertyFinancialsStatementUrl(r.propertyId, finSubForSource(r.source));
            const invoiceViewUrl = r.source === "INVOICE" && r.invoiceId ? invoiceDetailPath(r.invoiceId) : null;

            return (
              <ProplyticTableRow key={r.id}>
                <ProplyticTableCell>{r.date}</ProplyticTableCell>
                <ProplyticTableCell>
                  <Link className="pg-fins-name" to={`/owned-properties/${r.propertyId}?tab=financials&fin=statement`}>
                    {r.propertyName}
                  </Link>
                </ProplyticTableCell>
                <ProplyticTableCell style={{ minWidth: 160 }}>
                  {r.description}
                  {r.invoiceNumber ? (
                    <div className="pg-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Invoice {r.invoiceNumber}
                    </div>
                  ) : null}
                </ProplyticTableCell>
                <ProplyticTableCell style={{ minWidth: 120 }}>
                  {r.source === "INVOICE"
                    ? invoiceStatementDisplayType(r as unknown as Record<string, unknown>)
                    : r.type}
                </ProplyticTableCell>
                <ProplyticTableCell numeric>
                  {r.debit != null ? <ProplyticAmountCell tone="debit">{fmtZar(r.debit)}</ProplyticAmountCell> : "—"}
                </ProplyticTableCell>
                <ProplyticTableCell numeric>
                  {r.credit != null ? (
                    <ProplyticAmountCell tone={creditTone(r)}>{fmtZar(r.credit)}</ProplyticAmountCell>
                  ) : (
                    "—"
                  )}
                </ProplyticTableCell>
                {showRunningBalance ? (
                  <ProplyticTableCell numeric>
                    {r.balance != null ? <ProplyticAmountCell tone="balance">{fmtZar(r.balance)}</ProplyticAmountCell> : "—"}
                  </ProplyticTableCell>
                ) : null}
                <ProplyticTableCell>{r.source}</ProplyticTableCell>
                <ProplyticTableCell actions>
                  <ProplyticTableActions>
                    {r.source !== "INVOICE" ? (
                      <IconButton
                        icon="edit"
                        aria-label={`Edit on ${r.propertyName} financials`}
                        href={manageUrl}
                        variant="outline"
                      />
                    ) : null}
                    {invoiceViewUrl ? (
                      <IconButton icon="open" aria-label="View invoice" href={invoiceViewUrl} variant="outline" />
                    ) : null}
                  </ProplyticTableActions>
                </ProplyticTableCell>
              </ProplyticTableRow>
            );
          })}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
