import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE } from "./leaseDirectoryUtils";

export function LeasePagination({
  page,
  totalItems,
  pageSize = PAGE_SIZE,
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
    <footer className="pg-leases-pagination">
      <p className="pg-leases-pagination-summary">
        {totalItems === 0
          ? "No leases to show"
          : `Showing ${from} to ${to} of ${totalItems} lease${totalItems === 1 ? "" : "s"}`}
      </p>
      {totalPages > 1 ? (
        <nav className="pg-leases-pagination-nav" aria-label="Lease list pagination">
          <button
            type="button"
            className="pg-leases-page-btn"
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
              className={`pg-leases-page-btn ${p === safePage ? "pg-leases-page-btn--active" : ""}`}
              onClick={() => onPageChange(p)}
              aria-current={p === safePage ? "page" : undefined}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className="pg-leases-page-btn"
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
