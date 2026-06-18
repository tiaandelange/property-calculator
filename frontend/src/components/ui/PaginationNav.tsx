import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationNavProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  className?: string;
};

/** Numbered page controls — uses global theme tokens via `.pg-page-pagination-btn`. */
export function PaginationNav({
  page,
  totalPages,
  onPageChange,
  ariaLabel = "Pagination",
  className
}: PaginationNavProps) {
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const pages: number[] = [];
  const start = Math.max(1, safePage - 2);
  const end = Math.min(totalPages, safePage + 2);
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <nav className={["pg-page-pagination-nav", className].filter(Boolean).join(" ")} aria-label={ariaLabel}>
      <button
        type="button"
        className="pg-page-pagination-btn"
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
          className={`pg-page-pagination-btn${p === safePage ? " pg-page-pagination-btn--active" : ""}`}
          onClick={() => onPageChange(p)}
          aria-current={p === safePage ? "page" : undefined}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="pg-page-pagination-btn"
        disabled={safePage >= totalPages}
        onClick={() => onPageChange(safePage + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </nav>
  );
}
