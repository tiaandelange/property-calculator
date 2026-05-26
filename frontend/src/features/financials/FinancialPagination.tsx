import { FINANCIALS_PAGE_SIZE } from "./financialDirectoryUtils";

export function FinancialPagination({
  page,
  totalItems,
  onPageChange
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / FINANCIALS_PAGE_SIZE));
  if (totalItems <= FINANCIALS_PAGE_SIZE) return null;

  return (
    <div className="pg-fins-pagination">
      <button type="button" className="pg-btn pg-btn-ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <span className="pg-muted">
        Page {page} of {totalPages} · {totalItems.toLocaleString()} entries
      </span>
      <button
        type="button"
        className="pg-btn pg-btn-ghost"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
