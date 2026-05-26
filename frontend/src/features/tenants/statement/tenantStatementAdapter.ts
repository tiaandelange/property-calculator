import { getPropertyStatement, listPropertyInvoices } from "../../../api/ownedProperties";
import { deriveLeaseStatus, derivePaymentStatus } from "../tenantDirectoryAdapter";
import { fmtZar } from "../tenantDirectoryUtils";
import type {
  TenantInvoiceListItem,
  TenantLedgerTransaction,
  TenantStatementPeriodKey,
  TenantStatementSummary
} from "./tenantStatementTypes";

export { fmtZar };

const PAID = new Set(["PAID", "CANCELLED"]);

function padYm(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatPeriodLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-ZA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function resolveStatementPeriod(
  key: TenantStatementPeriodKey,
  leaseStartDate?: string | null
): { start: Date; end: Date; label: string; months: string[] } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  let start: Date;

  if (key === "this_month") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else if (key === "last_6_months") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  } else if (key === "last_12_months") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  } else {
    const ls = leaseStartDate ? parseYmd(String(leaseStartDate).slice(0, 10)) : null;
    start = ls ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= endMonth) {
    months.push(padYm(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return { start, end, label: formatPeriodLabel(start, end), months };
}

function normalizeTxnType(row: Record<string, unknown>): TenantLedgerTransaction["type"] {
  const src = String(row.source ?? "").toUpperCase();
  const st = String(row.status ?? "").toUpperCase();
  const typ = String(row.type ?? "").toLowerCase();
  if (typ.includes("late")) return "late_fee";
  if (typ.includes("adjust")) return "adjustment";
  if (typ.includes("balance")) return "balance";
  if (src === "INVOICE") return st === "PAID" ? "payment" : "charge";
  if (src === "INCOME") return st === "RECEIVED" ? "payment" : "charge";
  if (row.debit != null && Number(row.debit) > 0) return "charge";
  if (row.credit != null && Number(row.credit) > 0) return "payment";
  return "balance";
}

function rowBelongsToTenant(
  row: Record<string, unknown>,
  tenantLeaseIds: Set<string>,
  singleTenantProperty: boolean
): boolean {
  const src = String(row.source ?? "").toUpperCase();
  if (src === "EXPENSE") return false;
  if (src === "INVOICE") {
    const lid = row.leaseId != null ? String(row.leaseId) : "";
    return lid !== "" && tenantLeaseIds.has(lid);
  }
  if (src === "INCOME") return singleTenantProperty;
  return false;
}

function mapStatementRow(row: Record<string, unknown>): TenantLedgerTransaction {
  const debit = row.debit != null ? Number(row.debit) : 0;
  const credit = row.credit != null ? Number(row.credit) : 0;
  const type = normalizeTxnType(row);
  let amount = 0;
  if (type === "payment") amount = -(credit > 0 ? credit : debit);
  else if (type === "charge") amount = credit > 0 ? credit : debit;
  else amount = credit - debit;

  return {
    id: String(row.id ?? `${row.source}-${row.date}`),
    date: String(row.date ?? ""),
    description: String(row.description ?? ""),
    type,
    amount,
    balance: Number(row.balance ?? 0),
    source: row.source != null ? String(row.source) : undefined,
    status: row.status != null ? String(row.status) : undefined,
    raw: row
  };
}

export async function loadTenantFinancialBundle(opts: {
  propertyId: string;
  tenantId: string;
  tenantLeaseIds: string[];
  periodKey: TenantStatementPeriodKey;
  leaseStartDate?: string | null;
  singleTenantProperty: boolean;
  bustCache?: boolean;
}): Promise<{
  transactions: TenantLedgerTransaction[];
  invoices: TenantInvoiceListItem[];
  period: ReturnType<typeof resolveStatementPeriod>;
}> {
  const period = resolveStatementPeriod(opts.periodKey, opts.leaseStartDate);
  const leaseSet = new Set(opts.tenantLeaseIds.map(String));

  const monthStatements = await Promise.all(
    period.months.map((month) =>
      getPropertyStatement(opts.propertyId, { month, bustCache: opts.bustCache }).catch(() => null)
    )
  );

  const rowById = new Map<string, TenantLedgerTransaction>();
  for (const st of monthStatements) {
    const rows = (st?.statementRows ?? []) as Record<string, unknown>[];
    for (const r of rows) {
      if (!rowBelongsToTenant(r, leaseSet, opts.singleTenantProperty)) continue;
      const mapped = mapStatementRow(r);
      if (!mapped.date) continue;
      const d = parseYmd(mapped.date);
      if (!d || d < period.start || d > period.end) continue;
      rowById.set(mapped.id, mapped);
    }
  }

  const transactions = [...rowById.values()].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });

  const invRaw = await listPropertyInvoices(opts.propertyId);
  const invoices: TenantInvoiceListItem[] = (invRaw as Record<string, unknown>[])
    .filter((inv) => String(inv.tenantId ?? "") === String(opts.tenantId))
    .map((inv) => ({
      id: String(inv.id),
      invoiceNumber: String(inv.invoiceNumber ?? inv.id),
      status: String(inv.status ?? "DRAFT"),
      total: Number(inv.total ?? 0),
      dueDate: String(inv.dueDate ?? "").slice(0, 10),
      invoiceDate: String(inv.invoiceDate ?? "").slice(0, 10),
      paidAt: inv.paidAt != null ? String(inv.paidAt) : null,
      hasPdf: Boolean(inv.hasPdf)
    }));

  return { transactions, invoices, period };
}

export function buildTenantStatementSummary(opts: {
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  unitName?: string | null;
  tenantStatus?: string | null;
  period: ReturnType<typeof resolveStatementPeriod>;
  transactions: TenantLedgerTransaction[];
  invoices: TenantInvoiceListItem[];
  rentDueDay?: number | null;
}): TenantStatementSummary {
  const { period, transactions, invoices } = opts;

  let charges = 0;
  let payments = 0;
  let adjustments = 0;

  for (const t of transactions) {
    if (t.type === "charge" || t.type === "late_fee") charges += Math.abs(t.amount);
    else if (t.type === "payment" || t.type === "credit") payments += Math.abs(t.amount);
    else if (t.type === "adjustment") adjustments += t.amount;
  }

  const unpaid = invoices.filter((i) => !PAID.has(i.status.toUpperCase()));
  const outstandingBalance = unpaid.reduce((s, i) => s + (Number.isFinite(i.total) ? i.total : 0), 0);

  const thisYm = padYm(new Date());
  const monthInvoices = invoices.filter((i) => String(i.invoiceDate ?? "").slice(0, 7) === thisYm);
  const monthCharges = monthInvoices
    .filter((i) => !PAID.has(i.status.toUpperCase()))
    .reduce((s, i) => s + i.total, 0);
  const monthPayments = monthInvoices
    .filter((i) => i.status.toUpperCase() === "PAID")
    .reduce((s, i) => s + i.total, 0);

  const closingBalance = outstandingBalance;
  const openingBalance = closingBalance - charges + payments - adjustments;
  const availableCredit = closingBalance < 0 ? Math.abs(closingBalance) : 0;

  return {
    tenantId: opts.tenantId,
    tenantName: opts.tenantName,
    propertyId: opts.propertyId,
    propertyName: opts.propertyName,
    unitName: opts.unitName,
    status: opts.tenantStatus,
    statementPeriodStart: period.start.toISOString().slice(0, 10),
    statementPeriodEnd: period.end.toISOString().slice(0, 10),
    periodLabel: period.label,
    openingBalance,
    charges,
    payments,
    adjustments,
    closingBalance,
    outstandingBalance,
    availableCredit,
    monthCharges,
    monthPayments
  };
}

export function tenantStatusBadge(summary: TenantStatementSummary, leaseStatus: string): string {
  if (leaseStatus === "active") return "Active Tenant";
  if (leaseStatus === "overdue" || summary.outstandingBalance > 0) return "In Arrears";
  if (leaseStatus === "inactive" || leaseStatus === "expired") return "Inactive";
  return "Tenant";
}

export function paymentTermsNote(rentDueDay?: number | null): string {
  if (rentDueDay != null && rentDueDay >= 1 && rentDueDay <= 31) {
    return `Payment is due by the ${rentDueDay}${rentDueDay === 1 ? "st" : rentDueDay === 2 ? "nd" : rentDueDay === 3 ? "rd" : "th"} of each month. Please use your unique payment reference when making payments.`;
  }
  return "Payment is due by the 7th of each month. Please use your unique payment reference when making payments.";
}

export function deriveTenantLeaseStatusFromData(
  currentLease: Record<string, unknown> | null,
  invoices: { dueDate: string; status: string }[]
): string {
  if (!currentLease) return "inactive";
  return deriveLeaseStatus(
    {
      id: String(currentLease.id ?? ""),
      tenantId: String(currentLease.tenantId ?? ""),
      propertyId: String(currentLease.propertyId ?? ""),
      startDate: currentLease.startDate != null ? String(currentLease.startDate) : null,
      fixedTermEndDate: currentLease.fixedTermEndDate != null ? String(currentLease.fixedTermEndDate) : null,
      status: currentLease.status != null ? String(currentLease.status) : null
    },
    new Date()
  );
}

export function deriveTenantPaymentStatus(invoices: { dueDate: string; status: string; total?: number }[]): string {
  return derivePaymentStatus(
    invoices.map((i) => ({
      tenantId: "",
      dueDate: i.dueDate,
      status: i.status,
      total: i.total ?? 0
    }))
  );
}
