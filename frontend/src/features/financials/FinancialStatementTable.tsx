import { Link } from "react-router-dom";
import { ExternalLink, Pencil } from "lucide-react";
import { invoiceStatementCreditClass, invoiceStatementDisplayType } from "../invoices/invoiceStatementUtils";
import { invoiceDetailPath } from "../invoices/invoiceRoutes";
import type { FinancialStatementRow } from "./financialDirectoryTypes";
import { fmtZar, propertyFinancialsStatementUrl } from "./financialDirectoryUtils";

function finSubForSource(source: string): "statement" | "invoice" | "expenses" {
  if (source === "INVOICE") return "invoice";
  if (source === "EXPENSE") return "expenses";
  return "statement";
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
    return (
      <div className="pg-statement-wrap">
        <div className="pg-fins-table-skeleton" aria-hidden />
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="pg-statement-wrap">
      <table className="pg-statement-table pg-fins-statement-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Property</th>
            <th>Description</th>
            <th>Type</th>
            <th className="pg-statement-num">Debit</th>
            <th className="pg-statement-num">Credit</th>
            {showRunningBalance ? <th className="pg-statement-num">Balance</th> : null}
            <th>Source</th>
            <th>
              <span className="pg-fins-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => {
            const creditClass =
              r.source === "INVOICE" ? invoiceStatementCreditClass(r.status) : "";
            const manageUrl = propertyFinancialsStatementUrl(r.propertyId, finSubForSource(r.source));
            const invoiceViewUrl =
              r.source === "INVOICE" && r.invoiceId ? invoiceDetailPath(r.invoiceId) : null;

            return (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>
                  <Link className="pg-fins-name" to={`/owned-properties/${r.propertyId}?tab=financials&fin=statement`}>
                    {r.propertyName}
                  </Link>
                </td>
                <td style={{ minWidth: 160 }}>
                  {r.description}
                  {r.invoiceNumber ? (
                    <div className="pg-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Invoice {r.invoiceNumber}
                    </div>
                  ) : null}
                </td>
                <td style={{ minWidth: 120 }}>
                  {r.source === "INVOICE" ? invoiceStatementDisplayType(r as unknown as Record<string, unknown>) : r.type}
                </td>
                <td className="pg-statement-num">{r.debit != null ? fmtZar(r.debit) : "—"}</td>
                <td className={`pg-statement-num${creditClass ? ` ${creditClass}` : ""}`}>
                  {r.credit != null ? fmtZar(r.credit) : "—"}
                </td>
                {showRunningBalance ? (
                  <td className="pg-statement-num">{r.balance != null ? fmtZar(r.balance) : "—"}</td>
                ) : null}
                <td>{r.source}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div className="pg-fins-row-actions">
                    {r.source !== "INVOICE" ? (
                      <Link
                        className="pg-fins-action-btn"
                        to={manageUrl}
                        title="Edit on property financials"
                        aria-label={`Edit on ${r.propertyName} financials`}
                      >
                        <Pencil size={16} aria-hidden />
                      </Link>
                    ) : null}
                    {invoiceViewUrl ? (
                      <Link
                        className="pg-fins-action-btn"
                        to={invoiceViewUrl}
                        title="View invoice"
                        aria-label="View invoice"
                      >
                        <ExternalLink size={16} aria-hidden />
                        View
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
