import { isCurrentLeaseStatus, leaseDisplayStatus } from "../../../utils/leaseDisplay";

export type StatementRowForMetrics = {
  date?: string;
  source?: string;
  status?: string;
  credit?: number | null;
  debit?: number | null;
  expenseCategory?: string;
};

export type LeaseForVacancyMetrics = {
  startDate?: string | null;
  fixedTermEndDate?: string | null;
  monthlyRent?: number | null;
  status?: string | null;
};

const MAINTENANCE_CATEGORIES = new Set(["MAINTENANCE", "REPAIRS"]);

function parseYmd(ymd: string): Date | null {
  const s = String(ymd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function monthKeyUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthRangeKeys(startYmd: string, endYmd: string): string[] {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end || start > end) return [];

  const keys: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cur <= endMonth) {
    keys.push(monthKeyUtc(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return keys;
}

function monthBoundsUtc(monthKey: string): { start: Date; end: Date } | null {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return null;
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 0))
  };
}

function incomeFromStatementRow(r: StatementRowForMetrics): number {
  const credit = Number(r.credit ?? 0);
  if (!Number.isFinite(credit) || credit <= 0) return 0;
  const status = String(r.status ?? "").toUpperCase();
  if (r.source === "INCOME" && status === "RECEIVED") return credit;
  if (r.source === "INVOICE" && status === "PAID") return credit;
  return 0;
}

function maintenanceFromStatementRow(r: StatementRowForMetrics): number {
  if (r.source !== "EXPENSE" || String(r.status ?? "").toUpperCase() !== "ACTIVE") return 0;
  const cat = String(r.expenseCategory ?? "").toUpperCase();
  if (!MAINTENANCE_CATEGORIES.has(cat)) return 0;
  const debit = Number(r.debit ?? 0);
  return Number.isFinite(debit) && debit > 0 ? debit : 0;
}

/** Actual maintenance spend as a percentage of collected income over the statement period. */
export function computeMaintenancePercentFromStatement(rows: StatementRowForMetrics[]): number {
  let income = 0;
  let maintenance = 0;
  for (const r of rows) {
    if (!r.date) continue;
    income += incomeFromStatementRow(r);
    maintenance += maintenanceFromStatementRow(r);
  }
  if (income <= 0) return 0;
  return Math.round((maintenance / income) * 1000) / 10;
}

function leaseActiveDuringMonth(lease: LeaseForVacancyMetrics, monthKey: string): boolean {
  const bounds = monthBoundsUtc(monthKey);
  if (!bounds) return false;

  const leaseStart = lease.startDate ? parseYmd(String(lease.startDate)) : null;
  if (!leaseStart || leaseStart > bounds.end) return false;

  const display = leaseDisplayStatus({
    status: String(lease.status ?? ""),
    fixedTermEndDate: lease.fixedTermEndDate ?? null
  });

  if (!isCurrentLeaseStatus(display)) {
    const termEnd = lease.fixedTermEndDate ? parseYmd(String(lease.fixedTermEndDate)) : null;
    if (termEnd && termEnd < bounds.start) return false;
    if (["CANCELLED", "TERMINATED", "EXPIRED", "DRAFT"].includes(display)) return false;
  }

  return true;
}

function expectedRentForVacantMonth(
  monthKey: string,
  leases: LeaseForVacancyMetrics[],
  fallbackMonthlyRent: number
): number {
  const bounds = monthBoundsUtc(monthKey);
  if (!bounds) return Math.max(0, fallbackMonthlyRent);

  let best = 0;
  for (const lease of leases) {
    const start = lease.startDate ? parseYmd(String(lease.startDate)) : null;
    if (!start || start > bounds.end) continue;
    const rent = Number(lease.monthlyRent ?? 0);
    if (Number.isFinite(rent) && rent > best) best = rent;
  }
  if (best > 0) return best;
  return Math.max(0, fallbackMonthlyRent);
}

function resolveMetricsPeriod(
  statementRows: StatementRowForMetrics[],
  propertyCreatedAt: string | null | undefined,
  leases: LeaseForVacancyMetrics[]
): { startYmd: string; endYmd: string } {
  const today = new Date();
  const endYmd = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

  const candidates: string[] = [];
  if (propertyCreatedAt) candidates.push(String(propertyCreatedAt).slice(0, 10));
  for (const l of leases) {
    if (l.startDate) candidates.push(String(l.startDate).slice(0, 10));
  }
  for (const r of statementRows) {
    if (r.date) candidates.push(String(r.date).slice(0, 10));
  }

  const parsed = candidates.map(parseYmd).filter((d): d is Date => d != null);
  if (!parsed.length) return { startYmd: endYmd, endYmd };

  parsed.sort((a, b) => a.getTime() - b.getTime());
  const start = parsed[0]!;
  const startYmd = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
  return { startYmd, endYmd };
}

/**
 * Vacancy loss: for each month in the property period with no active lease,
 * the expected rent not collected counts toward vacancy. Percentage = vacancy loss / income × 100.
 */
export function computeVacancyPercentFromHistory(params: {
  statementRows: StatementRowForMetrics[];
  leases: LeaseForVacancyMetrics[];
  propertyCreatedAt?: string | null;
  fallbackMonthlyRent?: number;
}): number {
  const fallbackMonthlyRent = Math.max(0, Number(params.fallbackMonthlyRent ?? 0));
  const { startYmd, endYmd } = resolveMetricsPeriod(
    params.statementRows,
    params.propertyCreatedAt,
    params.leases
  );

  let income = 0;
  for (const r of params.statementRows) {
    if (!r.date) continue;
    income += incomeFromStatementRow(r);
  }

  let vacancyLoss = 0;
  for (const monthKey of monthRangeKeys(startYmd, endYmd)) {
    const hasLease = params.leases.some((lease) => leaseActiveDuringMonth(lease, monthKey));
    if (!hasLease) {
      vacancyLoss += expectedRentForVacantMonth(monthKey, params.leases, fallbackMonthlyRent);
    }
  }

  if (income <= 0) return 0;
  return Math.round((vacancyLoss / income) * 1000) / 10;
}

export function formatMetricPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0%";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}%`;
}

export function formatMetricsPeriodLabel(
  statementRows: StatementRowForMetrics[],
  propertyCreatedAt?: string | null,
  leases: LeaseForVacancyMetrics[] = []
): string {
  const { startYmd, endYmd } = resolveMetricsPeriod(statementRows, propertyCreatedAt, leases);
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };
  if (startYmd === endYmd) return fmt(startYmd);
  return `${fmt(startYmd)} – ${fmt(endYmd)}`;
}
