import { lineItemAmount } from "../invoices/invoiceLineItemUtils";
import type { StatementEntryType, StatementLineItemDraft } from "./statementTypes";

export function emptyStatementLine(
  unitPrice = 0,
  entryType: StatementEntryType = "DEBIT",
  description = ""
): StatementLineItemDraft {
  const qty = 1;
  const up = Number.isFinite(unitPrice) ? unitPrice : 0;
  return {
    description,
    category: entryType === "CREDIT" ? "DEPOSIT" : "OTHER",
    quantity: qty,
    unitPrice: up,
    total: lineItemAmount(qty, up),
    entryType,
    sortOrder: 0,
    taxRate: 0,
    transactionDate: null
  };
}

export function patchStatementLineItem(
  row: StatementLineItemDraft,
  patch: Partial<StatementLineItemDraft>
): StatementLineItemDraft {
  const next = { ...row, ...patch };
  const qty = Number.isFinite(next.quantity) ? next.quantity : 0;
  const up = Number.isFinite(next.unitPrice) ? next.unitPrice : 0;
  return { ...next, total: lineItemAmount(qty, up) };
}

export function sortStatementLineItems(items: StatementLineItemDraft[]): StatementLineItemDraft[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.description.localeCompare(b.description));
}

export function mapDbStatementLineItem(row: Record<string, unknown>, index: number): StatementLineItemDraft {
  const qty = Number(row.quantity ?? 1);
  const up = Number(row.unitPrice ?? row.unit_price ?? 0);
  const entry = String(row.entryType ?? row.entry_type ?? "DEBIT").toUpperCase() as StatementEntryType;
  return {
    description: String(row.description ?? ""),
    category: String(row.category ?? "OTHER"),
    quantity: qty,
    unitPrice: up,
    total: Number(row.total ?? lineItemAmount(qty, up)),
    entryType: entry === "CREDIT" ? "CREDIT" : "DEBIT",
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? index + 1),
    taxRate: 0,
    transactionDate:
      row.transactionDate != null
        ? String(row.transactionDate).slice(0, 10)
        : row.transaction_date != null
          ? String(row.transaction_date).slice(0, 10)
          : null
  };
}

export function statementLineItemsForSave(items: StatementLineItemDraft[]): Record<string, unknown>[] {
  return sortStatementLineItems(items).map((row, index) => ({
    description: row.description.trim(),
    quantity: row.quantity,
    unit_price: row.unitPrice,
    total: row.total,
    entry_type: row.entryType,
    category: row.category || null,
    transaction_date: row.transactionDate?.slice(0, 10) || null,
    sort_order: row.sortOrder || index + 1
  }));
}

export function calcStatementDebits(lines: StatementLineItemDraft[]): number {
  return lines
    .filter((l) => l.entryType === "DEBIT")
    .reduce((s, l) => s + (Number.isFinite(l.total) ? l.total : 0), 0);
}

export function calcStatementCredits(lines: StatementLineItemDraft[]): number {
  return lines
    .filter((l) => l.entryType === "CREDIT")
    .reduce((s, l) => s + (Number.isFinite(l.total) ? l.total : 0), 0);
}

/** Financial: debits minus credits. Deposit: credits minus debits (refund due). */
export function calcStatementNetTotal(
  lines: StatementLineItemDraft[],
  statementType: "FINANCIAL" | "DEPOSIT"
): number {
  const debits = calcStatementDebits(lines);
  const credits = calcStatementCredits(lines);
  return statementType === "DEPOSIT" ? credits - debits : debits - credits;
}
