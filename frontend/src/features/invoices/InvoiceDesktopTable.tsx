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
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { invoiceStatusLabel } from "./invoiceFoundation";

export function InvoiceDesktopTable({
  items,
  loading,
  busyId,
  onExportPdf,
  onDelete,
  rowWarmProps
}: {
  items: InvoiceDirectoryRow[];
  loading?: boolean;
  busyId?: string | null;
  onExportPdf: (row: InvoiceDirectoryRow) => void;
  onDelete: (row: InvoiceDirectoryRow) => void;
  rowWarmProps?: (row: InvoiceDirectoryRow) => {
    onMouseEnter: () => void;
    onFocus: () => void;
    onTouchStart: () => void;
  };
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
            <li key={row.id} {...(rowWarmProps ? rowWarmProps(row) : {})}>
              <ProplyticMobileRowCard
                title={
                  <Link className="pg-invoices-link" to={viewHref}>
                    {row.invoiceNumber}
                  </Link>
                }
                subtitle={row.tenantName}
                fields={[
                  { label: "Reference", value: row.leaseReference ?? "—" },
                  { label: "Status", value: invoiceStatusLabel(row.status) },
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
            <ProplyticTableHeadCell columnType="reference" columnPriority={1} sticky="start">
              Invoice #
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="reference" columnPriority={3}>
              Reference
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text" columnPriority={1}>
              Tenant
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="text" columnPriority={1}>
              Status
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="date" columnPriority={2}>
              Due Date
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="currency" columnPriority={1}>
              Amount Due
            </ProplyticTableHeadCell>
            <ProplyticTableHeadCell columnType="actions" columnPriority={1} />
          </ProplyticTableRow>
        </ProplyticTableHeader>
        <ProplyticTableBody>
          {items.map((row) => {
            const viewHref = invoiceDetailPath(row.id);
            const rowBusy = busyId === row.id;
            const amountDue = row.balanceDue > 0 ? row.balanceDue : row.total;

            const warm = rowWarmProps?.(row);

            return (
              <ProplyticTableRow key={row.id} {...(warm ?? {})}>
                <ProplyticTableCell columnType="reference" columnPriority={1} sticky="start">
                  <Link className="pg-invoices-link pg-invoices-num" to={viewHref}>
                    {row.invoiceNumber}
                  </Link>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="reference" columnPriority={3}>
                  {row.leaseReference ?? "—"}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="text" columnPriority={1}>
                  {row.tenantId ? (
                    <Link className="pg-invoices-link" to={`/tenants/${row.tenantId}`}>
                      {row.tenantName}
                    </Link>
                  ) : (
                    row.tenantName
                  )}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="text" columnPriority={1}>
                  <InvoiceStatusBadge status={row.status} />
                </ProplyticTableCell>
                <ProplyticTableCell columnType="date" columnPriority={2}>
                  {formatDateShort(row.dueDate)}
                </ProplyticTableCell>
                <ProplyticTableCell columnType="currency" columnPriority={1}>
                  <ProplyticAmountCell tone="balance">{fmtZar(amountDue)}</ProplyticAmountCell>
                </ProplyticTableCell>
                <ProplyticTableCell columnType="actions" columnPriority={1}>
                  <ProplyticTableRowActionsMenu
                    actions={[
                      {
                        key: "view",
                        label: "View invoice",
                        icon: "open",
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
