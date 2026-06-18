import { PAGE_SIZE } from "./tenantDirectoryUtils";
import { PaginationNav } from "../../components/ui/PaginationNav";

export function TenantPagination({
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
    <footer className="pg-tenants-pagination">
      <p className="pg-tenants-pagination-summary">
        {totalItems === 0
          ? "No tenants to show"
          : `Showing ${from} to ${to} of ${totalItems} tenant${totalItems === 1 ? "" : "s"}`}
      </p>
      <PaginationNav
        className="pg-tenants-pagination-nav"
        page={safePage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        ariaLabel="Tenant list pagination"
      />
    </footer>
  );
}
