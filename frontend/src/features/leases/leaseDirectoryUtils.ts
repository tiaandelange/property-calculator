export { fmtZar, formatDateShort, paginate, PAGE_SIZE } from "../tenants/tenantDirectoryUtils";

export function leaseTypeLabel(type: string | null | undefined): string {
  const t = String(type ?? "").toUpperCase();
  if (t === "MONTH_TO_MONTH") return "Month-to-month";
  if (t === "FIXED_TERM") return "Fixed term";
  return t ? t.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "—";
}

export function displayStatusLabel(status: string | null | undefined): string {
  const s = String(status ?? "").toUpperCase();
  const map: Record<string, string> = {
    ACTIVE: "Active",
    MONTH_TO_MONTH: "Month-to-month",
    DRAFT: "Draft",
    CANCELLED: "Cancelled",
    TERMINATED: "Terminated",
    EXPIRED: "Expired"
  };
  return map[s] ?? (s ? s.replace(/_/g, " ") : "Unknown");
}

export function lifecycleStatusLabel(status: string | null | undefined): string {
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

export function tenantInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}
