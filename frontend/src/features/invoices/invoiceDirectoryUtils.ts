import { normalizeInvoiceStatus } from "./invoiceFoundation";
import type { InvoiceDirectoryFilters, InvoiceDirectoryMetrics, InvoiceDirectoryRow } from "./invoiceDirectoryTypes";

export const INVOICE_PAGE_SIZE = 20;

const UNPAID = new Set(["DRAFT", "GENERATED", "SENT", "DUE", "PARTIALLY_PAID", "OVERDUE"]);
const TERMINAL = new Set(["PAID", "CANCELLED", "VOID"]);

export function fmtZar(n: number): string {
  return `R ${Math.round(n).toLocaleString("en-ZA")}`;
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export function localCalendarMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ymd(iso: string | null | undefined): string {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

export function isInvoiceUnpaid(status: string): boolean {
  return UNPAID.has(String(status).toUpperCase());
}

export function isInvoiceOverdue(row: Pick<InvoiceDirectoryRow, "status" | "dueDate">, today = new Date()): boolean {
  const st = String(row.status).toUpperCase();
  if (TERMINAL.has(st)) return false;
  if (st === "OVERDUE") return true;
  const due = ymd(row.dueDate);
  if (!due) return false;
  const todayYmd = today.toISOString().slice(0, 10);
  return due < todayYmd && isInvoiceUnpaid(st);
}

export function computeInvoiceMetrics(rows: InvoiceDirectoryRow[], today = new Date()): InvoiceDirectoryMetrics {
  const thisYm = localCalendarMonth(today);
  let totalOutstanding = 0;
  let dueThisMonth = 0;
  let overdue = 0;
  let paidThisMonth = 0;

  for (const row of rows) {
    const st = normalizeInvoiceStatus(row.status);
    const bal = Number.isFinite(row.balanceDue) && row.balanceDue > 0 ? row.balanceDue : row.total;

    if (isInvoiceUnpaid(st)) {
      totalOutstanding += bal;
      if (ymd(row.dueDate).slice(0, 7) === thisYm) dueThisMonth += bal;
      if (isInvoiceOverdue(row, today)) overdue += bal;
    }

    if (st === "PAID") {
      const paidYm = ymd(row.issueDate).slice(0, 7);
      if (paidYm === thisYm) paidThisMonth += row.total;
    }
  }

  return { totalOutstanding, dueThisMonth, overdue, paidThisMonth };
}

export function matchesInvoiceFilters(row: InvoiceDirectoryRow, filters: InvoiceDirectoryFilters): boolean {
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const hay = [
      row.invoiceNumber,
      row.leaseReference ?? "",
      row.tenantName,
      row.propertyName,
      row.status
    ]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }

  if (filters.propertyId !== "ALL" && row.propertyId !== filters.propertyId) return false;
  if (filters.status !== "ALL" && row.status !== filters.status) return false;

  const due = ymd(row.dueDate);
  if (filters.dateFrom && due && due < filters.dateFrom) return false;
  if (filters.dateTo && due && due > filters.dateTo) return false;

  return true;
}

export function paginate<T>(items: T[], page: number, pageSize = INVOICE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    totalPages,
    safePage
  };
}

export function invoiceCanHardDelete(_status: string): boolean {
  return true;
}

export function invoiceCanVoid(status: string): boolean {
  const s = String(status).toUpperCase();
  return ["SENT", "DUE", "OVERDUE", "PARTIALLY_PAID"].includes(s);
}
