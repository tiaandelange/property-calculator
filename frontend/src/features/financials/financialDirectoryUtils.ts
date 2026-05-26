import type { FinancialFilters, FinancialStatementRow } from "./financialDirectoryTypes";

export const FINANCIALS_PAGE_SIZE = 25;

export function localCalendarMonth(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function propertyFinancialsStatementUrl(propertyId: string, fin: "statement" | "expenses" | "invoice" = "statement"): string {
  return `/owned-properties/${encodeURIComponent(propertyId)}?tab=financials&fin=${fin}`;
}

export function fmtZar(n: unknown): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `R ${Math.round(x).toLocaleString()}`;
}

export function monthInRange(dateIso: string, monthYm: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(monthYm)) return true;
  return String(dateIso).slice(0, 7) === monthYm;
}

export function matchesFinancialFilters(row: FinancialStatementRow, filters: FinancialFilters): boolean {
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const hay = `${row.description} ${row.type} ${row.propertyName} ${row.source} ${row.status}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.propertyId !== "ALL" && row.propertyId !== filters.propertyId) return false;
  if (!monthInRange(row.date, filters.month)) return false;
  if (filters.source !== "ALL" && row.source !== filters.source) return false;
  return true;
}

export function paginate<T>(items: T[], page: number, pageSize = FINANCIALS_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    totalPages,
    page: safePage
  };
}

export function computeYtdTotals(rows: FinancialStatementRow[]) {
  const now = new Date();
  const year = now.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayLocal = `${year}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const ytdStart = `${year}-01-01`;

  let revenue = 0;
  let expenses = 0;
  let latestInRange = "";

  for (const r of rows) {
    if (!r.date || r.date < ytdStart || r.date > todayLocal) continue;
    if (r.date > latestInRange) latestInRange = r.date;

    if (r.source === "INCOME" && r.status === "RECEIVED" && r.credit != null) revenue += r.credit;
    else if (r.source === "INVOICE" && r.status === "PAID" && r.credit != null) revenue += r.credit;
    else if (r.source === "EXPENSE" && r.status === "ACTIVE" && r.debit != null) expenses += r.debit;
  }

  const periodEnd = latestInRange || todayLocal;
  const fmtPeriod = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  return {
    year,
    periodLabel: `${fmtPeriod(ytdStart)} – ${fmtPeriod(periodEnd)}`,
    revenue,
    expenses,
    cashFlow: revenue - expenses
  };
}
