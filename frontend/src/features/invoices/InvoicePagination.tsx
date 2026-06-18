import { INVOICE_PAGE_SIZE } from "./invoiceDirectoryUtils";
import { PaginationNav } from "../../components/ui/PaginationNav";

export function InvoicePagination({
  page,
  totalItems,
  pageSize = INVOICE_PAGE_SIZE,
  onPageChange
}: {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);

  return (
    <footer className="pg-invoices-pagination">
      <p className="pg-invoices-pagination-summary">
        {totalItems === 0
          ? "No invoices to show"
          : `Showing ${from} to ${to} of ${totalItems} invoice${totalItems === 1 ? "" : "s"}`}
      </p>
      <PaginationNav
        className="pg-invoices-pagination-nav"
        page={safePage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        ariaLabel="Invoice list pagination"
      />
    </footer>
  );
}
