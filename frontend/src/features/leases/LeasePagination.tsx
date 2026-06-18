import { PAGE_SIZE } from "./leaseDirectoryUtils";
import { PaginationNav } from "../../components/ui/PaginationNav";

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

  return (
    <footer className="pg-leases-pagination">
      <p className="pg-leases-pagination-summary">
        {totalItems === 0
          ? "No leases to show"
          : `Showing ${from} to ${to} of ${totalItems} lease${totalItems === 1 ? "" : "s"}`}
      </p>
      <PaginationNav
        className="pg-leases-pagination-nav"
        page={safePage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        ariaLabel="Lease list pagination"
      />
    </footer>
  );
}
