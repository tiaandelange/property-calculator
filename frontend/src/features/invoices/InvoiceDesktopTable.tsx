import { Link } from "react-router-dom";
import { IconButton } from "../../components/icons";
import {
  ProplyticAmountCell,
  ProplyticMobileRowCard,
  ProplyticMobileRowList,
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
import { useMediaQuery } from "../../hooks/useMediaQuery";
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
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (loading) {
    return <ProplyticTableSkeleton rows={6} />;
  }

  if (!items.length) return null;

  if (isMobile) {
    return (
      <ProplyticMobileRowList>
        {items.map((row) => {
          const viewHref = invoiceDetailPath(row.id);
          const rowBusy = busyId === row.id;
          const amountDue = row.balanceDue > 0 ? row.balanceDue : row.total;
          return (
            <li key={row.id}>
              <ProplyticMobileRowCard
                title={
                  <Link className="pg-invoices-link" to={viewHref}>
                    {row.invoiceNumber}
                  </Link>
                }
                subtitle={row.tenantName}
                fields={[
                  { label: "Reference", value: row.leaseReference ?? "—" },
                  { label: "Due date", value: formatDateShort(row.dueDate) },
                  { label: "Amount due", value: fmtZar(amountDue) }
                ]}
                actions={
                  <>
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
                  </>
                }
              />
            </li>
          );
        })}
      </ProplyticMobileRowList>
    );
  }

  return (
    <ProplyticTableWrap responsive>
      <ProplyticTable variant="financial">
        <ProplyticTableHeader>
          <ProplyticTableRow>
            <ProplyticTableHeadCell>Invoice #</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Reference</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Tenant</ProplyticTableHeadCell>
            <ProplyticTableHeadCell>Due Date</ProplyticTableHeadCell>
            <ProplyticTableHeadCell numeric>Amount Due</ProplyticTableHeadCell>
            <ProplyticTableHeadCell actions>
              <span className="pg-ptable-sr-only">Actions</span>
            </ProplyticTableHeadCell>
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((row) => {
            const viewHref = invoiceDetailPath(row.id);
            const rowBusy = busyId === row.id;
            const amountDue = row.balanceDue > 0 ? row.balanceDue : row.total;

            return (
              <ProplyticTableRow key={row.id}>
                <ProplyticTableCell>
                  <Link className="pg-invoices-link pg-invoices-num" to={viewHref}>
                    {row.invoiceNumber}
                  </Link>
                </ProplyticTableCell>
                <ProplyticTableCell>{row.leaseReference ?? "—"}</ProplyticTableCell>
                <ProplyticTableCell>
                  {row.tenantId ? (
                    <Link className="pg-invoices-link" to={`/tenants/${row.tenantId}`}>
                      {row.tenantName}
                    </Link>
                  ) : (
                    row.tenantName
                  )}
                </ProplyticTableCell>
                <ProplyticTableCell>{formatDateShort(row.dueDate)}</ProplyticTableCell>
                <ProplyticTableCell numeric>
                  <ProplyticAmountCell tone="balance">{fmtZar(amountDue)}</ProplyticAmountCell>
                </ProplyticTableCell>
                <ProplyticTableCell actions>
                  <ProplyticTableActions>
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
