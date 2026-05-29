import { Link } from "react-router-dom";
import { IconButton } from "../../components/icons";
import { invoiceDetailPath } from "./invoiceRoutes";
import { propertyLeasesPath } from "../leases/leaseRoutes";
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
            const viewHref = invoiceDetailPath(row.id);
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
                    <Link className="pg-invoices-link" to={propertyLeasesPath(row.propertyId, row.leaseId)}>
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
                    <IconButton icon="open" aria-label="View invoice" href={viewHref} variant="outline" />
                    {row.isEditable ? (
                      <IconButton icon="edit" aria-label="Edit invoice" href={viewHref} variant="outline" />
                    ) : null}
                    <IconButton
                      icon="download"
                      aria-label="Export PDF"
                      variant="outline"
                      disabled={rowBusy}
                      onClick={() => onExportPdf(row)}
                    />
                    {invoiceCanHardDelete(row.status) ? (
                      <IconButton
                        icon="delete"
                        aria-label="Delete invoice"
                        variant="danger"
                        disabled={rowBusy}
                        onClick={() => onDelete(row)}
                      />
                    ) : null}
                    {invoiceCanVoid(row.status) ? (
                      <IconButton
                        icon="void"
                        aria-label="Void invoice"
                        variant="danger"
                        disabled={rowBusy}
                        onClick={() => onVoid(row)}
                      />
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
