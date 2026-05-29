import { deriveLeaseStatus } from "../../tenants/tenantDirectoryAdapter";
import { isCurrentLeaseStatus } from "../../../utils/leaseDisplay";
import { isLeaseEndExpired } from "../../../utils/leaseTermUtils";

export type LeaseCardTag = { label: string; badgeClass: string };

export type LeaseCardLeaseInput = {
  id?: string | number;
  leaseType?: string;
  status?: string;
  displayStatus?: string;
  startDate?: string | Date | null;
  fixedTermEndDate?: string | Date | null;
  rentDueDay?: number | null;
  leaseReference?: string | null;
  reference?: string | null;
  notes?: string | null;
  tenantId?: string | number;
  tenant?: { id?: string; firstName?: string; lastName?: string } | null;
};

function parseLocalDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s = String(value).trim();
  const ymd = s.length >= 10 ? s.slice(0, 10) : s;
  const [y, m, d] = ymd.split("-").map(Number);
  if (y && m && d) return new Date(y, m - 1, d);
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLeaseCardDate(value: string | Date | null | undefined): string {
  const d = parseLocalDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function rentDueDayLabel(day: number | null | undefined): string {
  const d = Number(day);
  if (!Number.isFinite(d) || d < 1 || d > 31) return "—";
  if (d === 1) return "1st of the month";
  if (d === 31) return "Last day of the month";
  const suffix = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return `${d}${suffix} of the month`;
}

function calendarMonthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function daysUntil(end: Date, today: Date): number {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endDay.getTime() - startOfToday.getTime()) / 86_400_000);
}

/** Human lease type line, e.g. "12 months" or "Month-to-month". */
export function leaseTermTypeLabel(lease: LeaseCardLeaseInput): string {
  const display = String(lease.displayStatus ?? lease.status ?? "").toUpperCase();
  const leaseType = String(lease.leaseType ?? "").toUpperCase();

  if (display === "MONTH_TO_MONTH" || leaseType === "MONTH_TO_MONTH") {
    return "Month-to-month";
  }

  const start = parseLocalDate(lease.startDate);
  const end = parseLocalDate(lease.fixedTermEndDate);
  if (!end) return "Month-to-month";
  if (!start) return "Fixed term";

  const months = calendarMonthsBetween(start, end);
  if (months === 6) return "6 months";
  if (months === 12) return "12 months";
  if (months === 24) return "24 months";
  if (months >= 1) return `${months} months`;
  return "Fixed term";
}

export function leaseReferenceDisplay(lease: LeaseCardLeaseInput): string {
  const ref = lease.leaseReference ?? lease.reference;
  const trimmed = ref != null ? String(ref).trim() : "";
  return trimmed || "No";
}

export function leaseCardStatusTags(lease: LeaseCardLeaseInput, today = new Date()): LeaseCardTag[] {
  const tags: LeaseCardTag[] = [];
  const display = String(lease.displayStatus ?? lease.status ?? "").toUpperCase();
  const end = parseLocalDate(lease.fixedTermEndDate);
  const endYmd = end ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}` : "";

  const lifecycle = deriveLeaseStatus(
    {
      id: String(lease.id ?? ""),
      tenantId: String(lease.tenantId ?? ""),
      propertyId: "",
      startDate: lease.startDate != null ? String(lease.startDate) : null,
      fixedTermEndDate: lease.fixedTermEndDate != null ? String(lease.fixedTermEndDate) : null,
      status: lease.status != null ? String(lease.status) : null
    },
    today
  );

  if (display === "CANCELLED") {
    tags.push({ label: "Cancelled", badgeClass: "pg-pfin-badge pg-pfin-badge--muted" });
    return tags;
  }
  if (display === "TERMINATED") {
    tags.push({ label: "Terminated", badgeClass: "pg-pfin-badge pg-pfin-badge--muted" });
    return tags;
  }
  if (display === "DRAFT") {
    tags.push({ label: "Draft", badgeClass: "pg-pfin-badge pg-pfin-badge--warning" });
    return tags;
  }

  const expired = Boolean(endYmd && isLeaseEndExpired(endYmd, today)) || lifecycle === "expired" || display === "EXPIRED";

  if (expired) {
    tags.push({ label: "Expired", badgeClass: "pg-pfin-badge pg-pfin-badge--danger" });
    return tags;
  }

  if (display === "MONTH_TO_MONTH" && isCurrentLeaseStatus(display)) {
    tags.push({ label: "Month-to-month", badgeClass: "pg-pfin-badge pg-pfin-badge--info" });
    return tags;
  }

  if (end && isCurrentLeaseStatus(display)) {
    const monthsLeft = calendarMonthsBetween(today, end);
    const daysLeft = daysUntil(end, today);

    if (monthsLeft >= 2) {
      tags.push({
        label: `${monthsLeft} months left`,
        badgeClass: monthsLeft <= 3 ? "pg-pfin-badge pg-pfin-badge--warning" : "pg-pfin-badge pg-pfin-badge--success"
      });
    } else if (monthsLeft === 1) {
      tags.push({ label: "1 month left", badgeClass: "pg-pfin-badge pg-pfin-badge--warning" });
    } else if (daysLeft >= 0 && daysLeft <= 30) {
      tags.push({
        label: daysLeft === 0 ? "Ends today" : `${daysLeft} days left`,
        badgeClass: "pg-pfin-badge pg-pfin-badge--warning"
      });
    } else if (lifecycle === "ending_soon") {
      tags.push({ label: "Ending soon", badgeClass: "pg-pfin-badge pg-pfin-badge--warning" });
    } else {
      tags.push({ label: "Active", badgeClass: "pg-pfin-badge pg-pfin-badge--success" });
    }
    return tags;
  }

  if (isCurrentLeaseStatus(display)) {
    tags.push({ label: "Active", badgeClass: "pg-pfin-badge pg-pfin-badge--success" });
  }

  return tags;
}

export function leaseTenantDisplayName(
  lease: LeaseCardLeaseInput,
  fallbackTenants?: Array<{ id?: string | number; firstName?: string; lastName?: string }>
): string {
  const tn = lease.tenant ?? fallbackTenants?.find((t) => String(t.id) === String(lease.tenantId));
  const name = `${tn?.firstName ?? ""} ${tn?.lastName ?? ""}`.trim();
  return name || "Unknown tenant";
}

export function leaseTenantHref(
  lease: LeaseCardLeaseInput,
  fallbackTenants?: Array<{ id?: string | number; firstName?: string; lastName?: string }>
): string | null {
  const tn = lease.tenant ?? fallbackTenants?.find((t) => String(t.id) === String(lease.tenantId));
  return tn?.id != null ? `/tenants/${tn.id}` : null;
}
