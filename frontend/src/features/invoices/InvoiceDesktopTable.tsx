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
  ProplyticTableWrap,
  ProplyticTableRowActionsMenu
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
            <ProplyticTableHeadCell columnType="reference">Invoice #</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="reference">Reference</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text">Tenant</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="date">Due Date</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency">Amount Due</ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="actions" />
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((row) => {
            const viewHref = invoiceDetailPath(row.id);
            const rowBusy = busyId === row.id;
            const amountDue = row.balanceDue > 0 ? row.balanceDue : row.total;

            return (
              <ProplyticTableRow key={row.id}>
                <ProplyticTableCell columnType="reference">
                  <Link className="pg-invoices-link pg-invoices-num" to={viewHref}>
                    {row.invoiceNumber}
                  </Link>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="reference">{row.leaseReference ?? "—"}</ProplyticTableCell>
                <ProplyticTableCell columnType="text">
                  {row.tenantId ? (
                    <Link className="pg-invoices-link" to={`/tenants/${row.tenantId}`}>
                      {row.tenantName}
                    </Link>
                  ) : (
                    row.tenantName
                  )}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="date">{formatDateShort(row.dueDate)}</ProplyticTableCell>
                <ProplyticTableCell columnType="currency">
                  <ProplyticAmountCell tone="balance">{fmtZar(amountDue)}</ProplyticAmountCell>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="actions">
                  <ProplyticTableRowActionsMenu
                    actions={[
                      {
                        key: "view",
                        label: "View invoice",
                        icon: "edit",
                        href: viewHref,
                        primary: true
                      },
                      {
                        key: "download",
                        label: "Download PDF",
                        icon: "download",
                        disabled: rowBusy,
                        onClick: () => onExportPdf(row)
                      },
                      {
                        key: "delete",
                        label: "Delete invoice",
                        icon: "delete",
                        disabled: rowBusy,
                        onClick: () => onDelete(row),
                        destructive: true
                      }
                    ]}
                  />
                </ProplyticTableCell>
              </ProplyticTableRow>
            );
          })}
        </ProplyticTableBody>
      </ProplyticTable>
    </ProplyticTableWrap>
  );
}
