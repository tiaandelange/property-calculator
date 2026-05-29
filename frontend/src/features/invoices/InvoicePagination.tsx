import { ChevronLeft, ChevronRight } from "lucide-react";
import { INVOICE_PAGE_SIZE } from "./invoiceDirectoryUtils";

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

  const pages: number[] = [];
  const start = Math.max(1, safePage - 2);
  const end = Math.min(totalPages, safePage + 2);
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <footer className="pg-invoices-pagination">
      <p className="pg-invoices-pagination-summary">
        {totalItems === 0
          ? "No invoices to show"
          : `Showing ${from} to ${to} of ${totalItems} invoice${totalItems === 1 ? "" : "s"}`}
      </p>
      {totalPages > 1 ? (
        <nav className="pg-invoices-pagination-nav" aria-label="Invoice list pagination">
          <button
            type="button"
            className="pg-invoices-page-btn"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className={`pg-invoices-page-btn ${p === safePage ? "pg-invoices-page-btn--active" : ""}`}
              onClick={() => onPageChange(p)}
              aria-current={p === safePage ? "page" : undefined}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className="pg-invoices-page-btn"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </nav>
      ) : null}
    </footer>
  );
}
