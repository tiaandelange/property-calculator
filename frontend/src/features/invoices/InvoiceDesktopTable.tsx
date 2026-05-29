import { Download, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { tenantInvoiceEditorPath } from "./invoiceRoutes";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import type { InvoiceDirectoryRow } from "./invoiceDirectoryTypes";
import { fmtZar, formatDateShort, invoiceCanHardDelete, invoiceCanVoid } from "./invoiceDirectoryUtils";

export function InvoiceDesktopTable({
  items,
  loading,
  busyId,
  onExportPdf,
  onDelete,
  onVoid
}: {
  items: InvoiceDirectoryRow[];
  loading?: boolean;
  busyId?: string | null;
  onExportPdf: (row: InvoiceDirectoryRow) => void;
  onDelete: (row: InvoiceDirectoryRow) => void;
  onVoid: (row: InvoiceDirectoryRow) => void;
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
            <th scope="col">Tenant</th>
            <th scope="col">Property</th>
            <th scope="col">Unit</th>
            <th scope="col">Lease</th>
            <th scope="col">Period</th>
            <th scope="col">Issue</th>
            <th scope="col">Due</th>
            <th scope="col">Total</th>
            <th scope="col">Balance</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="pg-invoices-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const viewHref = tenantInvoiceEditorPath(row.tenantId, row.id, row.propertyId);
            const rowBusy = busyId === row.id;

            return (
              <tr key={row.id}>
                <td>
                  <strong className="pg-invoices-num">{row.invoiceNumber}</strong>
                </td>
                <td>
                  {row.tenantId ? (
                    <Link className="pg-invoices-link" to={`/tenants/${row.tenantId}`}>
                      {row.tenantName}
                    </Link>
                  ) : (
                    row.tenantName
                  )}
                </td>
                <td>
                  <Link className="pg-invoices-link" to={`/owned-properties/${row.propertyId}?tab=financials&fin=statement`}>
                    {row.propertyName}
                  </Link>
                </td>
                <td>{row.unitLabel ?? "—"}</td>
                <td>
                  {row.leaseId ? (
                    <Link className="pg-invoices-link" to={`/leases/${row.leaseId}`}>
                      {row.leaseLabel ?? "View"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{row.invoicePeriod ?? "—"}</td>
                <td>{formatDateShort(row.issueDate)}</td>
                <td>{formatDateShort(row.dueDate)}</td>
                <td>{fmtZar(row.total)}</td>
                <td>{fmtZar(row.balanceDue)}</td>
                <td>
                  <InvoiceStatusBadge status={row.status} />
                </td>
                <td>
                  <div className="pg-invoices-actions">
                    <Link className="pg-invoices-action-btn" to={viewHref} title="View invoice" aria-label="View invoice">
                      <ExternalLink size={16} aria-hidden />
                    </Link>
                    {row.isEditable ? (
                      <Link className="pg-invoices-action-btn" to={viewHref} title="Edit invoice" aria-label="Edit invoice">
                        <Pencil size={16} aria-hidden />
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="pg-invoices-action-btn"
                      title="Export PDF"
                      aria-label="Export PDF"
                      disabled={rowBusy}
                      onClick={() => onExportPdf(row)}
                    >
                      <Download size={16} aria-hidden />
                    </button>
                    {invoiceCanHardDelete(row.status) ? (
                      <button
                        type="button"
                        className="pg-invoices-action-btn pg-invoices-action-btn--danger"
                        title="Delete invoice"
                        aria-label="Delete invoice"
                        disabled={rowBusy}
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    ) : null}
                    {invoiceCanVoid(row.status) ? (
                      <button
                        type="button"
                        className="pg-invoices-action-btn pg-invoices-action-btn--danger"
                        title="Void invoice"
                        aria-label="Void invoice"
                        disabled={rowBusy}
                        onClick={() => onVoid(row)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
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
