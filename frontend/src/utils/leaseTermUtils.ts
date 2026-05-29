export type LeaseTermPreset = "6" | "12" | "24" | "manual";

export const LEASE_TERM_PRESET_OPTIONS: { value: LeaseTermPreset; label: string }[] = [
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "24", label: "24 months" },
  { value: "manual", label: "Calendar (manual)" }
];

/** Local calendar YYYY-MM-DD (avoids UTC drift). */
export function formatLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Add whole months to a YYYY-MM-DD start date in local calendar. */
export function addMonthsToLocalDate(startYmd: string, months: number): string {
  const [y, m, d] = startYmd.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + months);
  return formatLocalYmd(date);
}

export function computeEndDateFromTerm(startYmd: string, termPreset: LeaseTermPreset, manualEndYmd: string): string {
  if (termPreset === "manual") return manualEndYmd.trim();
  if (!startYmd.trim()) return "";
  return addMonthsToLocalDate(startYmd, Number(termPreset));
}

/** True when the lease term end date is before today (local calendar). */
export function isLeaseEndExpired(endYmd: string, today = new Date()): boolean {
  const trimmed = endYmd.trim();
  if (!trimmed) return false;
  const [y, m, d] = trimmed.split("-").map(Number);
  if (!y || !m || !d) return false;
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return end.getTime() < startOfToday.getTime();
}

/** Active fixed-term leases past end date are treated as month-to-month. */
export function resolveLeaseTypeFromEndDate(endYmd: string | null | undefined): "FIXED_TERM" | "MONTH_TO_MONTH" {
  const end = endYmd?.trim();
  if (!end) return "MONTH_TO_MONTH";
  if (isLeaseEndExpired(end)) return "MONTH_TO_MONTH";
  return "FIXED_TERM";
}
