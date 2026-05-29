import { Link } from "react-router-dom";
import { IconButton } from "../../components/icons";
import { invoiceDetailPath } from "./invoiceRoutes";
import type { InvoiceDirectoryRow } from "./invoiceDirectoryTypes";
import { fmtZar, formatDateShort } from "./invoiceDirectoryUtils";

export function InvoiceDesktopTable({
  items,
  loading,
  busyId,
  onExportPdf,
  onDelete
}: {
  items: InvoiceDirectoryRow[];
  loading?: boolean;
  busyId?: string | null;
  onExportPdf: (row: InvoiceDirectoryRow) => void;
  onDelete: (row: InvoiceDirectoryRow) => void;
}) {
  if (loading) {
    return (
      <div className="pg-invoices-table-wrap">
        <div className="pg-invoices-table-skeleton" aria-hidden />
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="pg-invoices-table-wrap">
      <table className="pg-invoices-table">
        <thead>
          <tr>
            <th scope="col">Invoice #</th>
            <th scope="col">Reference</th>
            <th scope="col">Tenant</th>
            <th scope="col">Due Date</th>
            <th scope="col" className="pg-invoices-table__num">
              Amount Due
            </th>
            <th scope="col">
              <span className="pg-invoices-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const viewHref = invoiceDetailPath(row.id);
            const rowBusy = busyId === row.id;
            const amountDue = row.balanceDue > 0 ? row.balanceDue : row.total;

            return (
              <tr key={row.id}>
                <td>
                  <Link className="pg-invoices-link pg-invoices-num" to={viewHref}>
                    {row.invoiceNumber}
                  </Link>
                </td>
                <td>{row.leaseReference ?? "—"}</td>
                <td>
                  {row.tenantId ? (
                    <Link className="pg-invoices-link" to={`/tenants/${row.tenantId}`}>
                      {row.tenantName}
                    </Link>
                  ) : (
                    row.tenantName
                  )}
                </td>
                <td>{formatDateShort(row.dueDate)}</td>
                <td className="pg-invoices-table__num">{fmtZar(amountDue)}</td>
                <td>
                  <div className="pg-invoices-actions">
                    <IconButton icon="open" aria-label="View invoice" href={viewHref} variant="outline" />
                    <IconButton
                      icon="download"
                      aria-label="Download PDF"
                      variant="outline"
                      disabled={rowBusy}
                      onClick={() => onExportPdf(row)}
                    />
                    <IconButton
                      icon="delete"
                      aria-label="Delete invoice"
                      variant="danger"
                      disabled={rowBusy}
                      onClick={() => onDelete(row)}
                    />
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
