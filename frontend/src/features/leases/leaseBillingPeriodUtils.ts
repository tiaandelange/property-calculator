/** YYYY-MM billing period options around the current calendar month. */
export function billingPeriodOptions(anchor = new Date()): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (let offset = -1; offset <= 2; offset += 1) {
    const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" });
    opts.push({ value, label });
  }
  return opts;
}

/** Default period: current month, or next if past rent due day this month. */
export function defaultBillingPeriod(rentDueDay: number, anchor = new Date()): string {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const dom = anchor.getUTCDate();
  const dueDay = Math.min(31, Math.max(1, rentDueDay || 1));
  const useNext = dom > dueDay;
  const d = new Date(Date.UTC(y, m + (useNext ? 1 : 0), 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function dueDateForBillingPeriod(period: string, rentDueDay: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const lastDom = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dom = Math.min(Math.max(rentDueDay || 1, 1), lastDom);
  return `${year}-${String(month).padStart(2, "0")}-${String(dom).padStart(2, "0")}`;
}

export const MANUAL_INVOICE_TYPE_OPTIONS = [
  { value: "RENT", label: "Monthly Rent" },
  { value: "UTILITY_RECOVERY", label: "Utility Recovery" },
  { value: "MANUAL", label: "Manual" },
  { value: "OTHER", label: "Other" }
] as const;

export type ManualInvoiceType = (typeof MANUAL_INVOICE_TYPE_OPTIONS)[number]["value"];
