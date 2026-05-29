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

/** Add calendar days to a YYYY-MM-DD date in local time. */
export function addDaysToLocalDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatLocalYmd(date);
}

/**
 * Fixed-term end date for preset lengths: N months from start, minus one day.
 * E.g. start 2026-08-15 + 12 months → 2027-08-14 (not the same calendar day).
 */
export function fixedTermEndFromPreset(startYmd: string, months: number): string {
  const anniversary = addMonthsToLocalDate(startYmd, months);
  if (!anniversary) return "";
  return addDaysToLocalDate(anniversary, -1);
}

/** Whole months between start and end when end is the inclusive last day (day before anniversary). */
export function termMonthsFromStartAndEnd(startYmd: string, endYmd: string): number {
  const exclusiveEnd = addDaysToLocalDate(endYmd.trim().slice(0, 10), 1);
  if (!exclusiveEnd) return 0;
  const [sy, sm, sd] = startYmd.trim().slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = exclusiveEnd.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 0;
  let months = (ey - sy) * 12 + (em - sm);
  if (ed < sd) months -= 1;
  return Math.max(0, months);
}

export function computeEndDateFromTerm(startYmd: string, termPreset: LeaseTermPreset, manualEndYmd: string): string {
  if (termPreset === "manual") return manualEndYmd.trim();
  if (!startYmd.trim()) return "";
  return fixedTermEndFromPreset(startYmd, Number(termPreset));
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
