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

/** Individual tenant name (never the joint "A & B" label used on the applicants tab). */
export function tenantRowDisplayName(
  item: Pick<TenantListItem, "firstName" | "lastName" | "fullName">
): string {
  const individual = `${String(item.firstName ?? "").trim()} ${String(item.lastName ?? "").trim()}`.trim();
  return individual || String(item.fullName ?? "").trim() || "Tenant";
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

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): { slice: T[]; totalPages: number; totalCount: number } {
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { slice: items.slice(start, start + pageSize), totalPages, totalCount };
}

export function matchesTenantDirectoryFilters(
  item: TenantListItem,
  filters: {
    q?: string;
    propertyId?: string | null;
    leaseStatus?: string;
    paymentStatus?: string;
    tab?: "tenants" | "applicants";
  }
): boolean {
  const isApplicant = String(item.tenantStatus ?? "").toUpperCase() === "APPLICANT";
  if (filters.tab === "applicants" && !isApplicant) return false;
  if (filters.tab === "tenants" && isApplicant) return false;

  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) {
    const hay = `${item.fullName} ${item.email ?? ""} ${item.phone ?? ""} ${item.propertyName ?? ""} ${item.propertyAddress ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.propertyId && filters.propertyId !== "ALL" && item.propertyId !== filters.propertyId) return false;
  if (filters.leaseStatus && filters.leaseStatus !== "ALL" && item.leaseStatus !== filters.leaseStatus) return false;
  if (filters.paymentStatus && filters.paymentStatus !== "ALL" && item.paymentStatus !== filters.paymentStatus) return false;
  return true;
}
