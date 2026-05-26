import type { TenantListItem, TenantLeaseStatus, TenantPaymentStatus } from "./tenantDirectoryTypes";

export function fmtZar(n: unknown): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `R ${Math.round(x).toLocaleString()}`;
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export function tenantInitials(item: Pick<TenantListItem, "firstName" | "lastName" | "fullName">): string {
  const a = String(item.firstName ?? "").trim()[0] ?? "";
  const b = String(item.lastName ?? "").trim()[0] ?? "";
  if (a || b) return `${a}${b}`.toUpperCase();
  return String(item.fullName ?? "?").slice(0, 2).toUpperCase();
}

export function paymentStatusLabel(status: TenantPaymentStatus | null | undefined): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "pending":
      return "Pending";
    case "overdue":
      return "Overdue";
    default:
      return "Unknown";
  }
}

export function leaseStatusLabel(status: TenantLeaseStatus | null | undefined): string {
  switch (status) {
    case "active":
      return "Active";
    case "ending_soon":
      return "Ending Soon";
    case "notice":
      return "Notice";
    case "expired":
      return "Expired";
    case "inactive":
      return "Inactive";
    default:
      return status ? String(status) : "Unknown";
  }
}

export const PAGE_SIZE = 6;

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): { slice: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { slice: items.slice(start, start + pageSize), totalPages };
}
