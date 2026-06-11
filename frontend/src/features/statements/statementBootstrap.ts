import { getPropertyStatement } from "../../api/ownedProperties";
import { loadTenantFinancialBundle } from "../tenants/statement/tenantStatementAdapter";
import type { TenantLedgerTransaction } from "../tenants/statement/tenantStatementTypes";
import { resolveStatementDocumentPeriod } from "./statementPeriodUtils";
import { emptyStatementLine, patchStatementLineItem, sortStatementLineItems } from "./statementLineItemUtils";
import type { StatementLineItemDraft } from "./statementTypes";
import type { StatementPeriodKey } from "./statementTypes";

function txnEntryType(t: TenantLedgerTransaction): "DEBIT" | "CREDIT" {
  if (t.type === "payment" || t.type === "credit") return "CREDIT";
  if (t.amount < 0) return "CREDIT";
  return "DEBIT";
}

function txnCategory(t: TenantLedgerTransaction): string {
  if (t.type === "late_fee") return "LATE_FEE";
  if (t.type === "adjustment") return "OTHER";
  if (t.type === "payment" || t.type === "credit") return "PAYMENT";
  return "RENT";
}

export function ledgerTransactionsToStatementLines(
  transactions: TenantLedgerTransaction[],
  openingBalance: number
): StatementLineItemDraft[] {
  const lines: StatementLineItemDraft[] = [];
  let order = 1;

  if (openingBalance !== 0) {
    lines.push(
      patchStatementLineItem(emptyStatementLine(Math.abs(openingBalance), openingBalance >= 0 ? "DEBIT" : "CREDIT"), {
        description: "Opening balance",
        category: "BALANCE",
        sortOrder: order++,
        transactionDate: transactions[0]?.date?.slice(0, 10) ?? null
      })
    );
  }

  for (const t of transactions) {
    const entryType = txnEntryType(t);
    lines.push(
      patchStatementLineItem(emptyStatementLine(Math.abs(t.amount), entryType, t.description || t.type), {
        category: txnCategory(t),
        sortOrder: order++,
        transactionDate: t.date?.slice(0, 10) ?? null
      })
    );
  }

  return sortStatementLineItems(lines);
}

export function depositOpeningLine(depositAmount: number): StatementLineItemDraft {
  return patchStatementLineItem(
    emptyStatementLine(depositAmount > 0 ? depositAmount : 0, "CREDIT", "Deposit held (opening balance)"),
    { category: "DEPOSIT", sortOrder: 1 }
  );
}

export function emptyDepositExpenseLine(): StatementLineItemDraft {
  return patchStatementLineItem(emptyStatementLine(0, "DEBIT", "Cleaning / repairs"), {
    category: "OTHER",
    sortOrder: 2
  });
}

export async function loadFinancialStatementLines(opts: {
  propertyId: string;
  tenantId: string;
  tenantLeaseIds: string[];
  leaseStartDate?: string | null;
  periodKey: StatementPeriodKey;
  singleTenantProperty: boolean;
}): Promise<{
  lines: StatementLineItemDraft[];
  period: ReturnType<typeof resolveStatementDocumentPeriod>;
  openingBalance: number;
}> {
  const period = resolveStatementDocumentPeriod(opts.periodKey, opts.leaseStartDate);
  const ledgerKey = opts.periodKey === "last_3_months" ? "last_3_months" : opts.periodKey;

  const bundle = await loadTenantFinancialBundle({
    propertyId: opts.propertyId,
    tenantId: opts.tenantId,
    tenantLeaseIds: opts.tenantLeaseIds,
    periodKey: ledgerKey,
    leaseStartDate: opts.leaseStartDate,
    singleTenantProperty: opts.singleTenantProperty,
    bustCache: true
  });

  const filtered = bundle.transactions.filter((t) => {
    const d = t.date?.slice(0, 10);
    if (!d) return false;
    return d >= period.startYmd && d <= period.endYmd;
  });

  let charges = 0;
  let payments = 0;
  for (const t of filtered) {
    if (t.type === "charge" || t.type === "late_fee") charges += Math.abs(t.amount);
    else if (t.type === "payment" || t.type === "credit") payments += Math.abs(t.amount);
  }
  const closingBalance = charges - payments;
  const openingBalance = closingBalance - charges + payments;

  return {
    lines: ledgerTransactionsToStatementLines(filtered, openingBalance),
    period,
    openingBalance
  };
}

/** Fallback when ledger bundle is empty — pull raw statement rows for the period months. */
export async function loadFinancialStatementLinesDirect(opts: {
  propertyId: string;
  tenantId: string;
  tenantLeaseIds: string[];
  periodKey: StatementPeriodKey;
  leaseStartDate?: string | null;
}): Promise<StatementLineItemDraft[]> {
  const result = await loadFinancialStatementLines({
    ...opts,
    singleTenantProperty: false
  });
  if (result.lines.length > 0) return result.lines;

  const period = resolveStatementDocumentPeriod(opts.periodKey, opts.leaseStartDate);
  const months: string[] = [];
  const cursor = new Date(period.start);
  const endMonth = new Date(period.end.getUTCFullYear(), period.end.getUTCMonth(), 1);
  while (cursor <= endMonth) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const leaseSet = new Set(opts.tenantLeaseIds.map(String));
  const rows: TenantLedgerTransaction[] = [];
  for (const month of months) {
    const st = await getPropertyStatement(opts.propertyId, { month }).catch(() => null);
    for (const r of (st?.statementRows ?? []) as Record<string, unknown>[]) {
      const tid = r.tenantId != null ? String(r.tenantId) : "";
      const lid = r.leaseId != null ? String(r.leaseId) : "";
      if (tid !== opts.tenantId && !leaseSet.has(lid)) continue;
      const date = String(r.date ?? "").slice(0, 10);
      if (date < period.startYmd || date > period.endYmd) continue;
      rows.push({
        id: String(r.id ?? `${month}-${date}`),
        date,
        description: String(r.description ?? ""),
        type: "charge",
        amount: Number(r.debit ?? r.credit ?? 0),
        balance: Number(r.balance ?? 0)
      });
    }
  }

  return ledgerTransactionsToStatementLines(rows, 0);
}
