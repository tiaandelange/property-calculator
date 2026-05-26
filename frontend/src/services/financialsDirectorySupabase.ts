import { listProperties } from "./propertiesSupabase";
import { getPropertyMonthlyStatement, supabaseStatementPropertyId } from "./statementsSupabase";
import type {
  FinancialDirectoryMetrics,
  FinancialStatementRow,
  FinancialsDirectoryResult
} from "../features/financials/financialDirectoryTypes";
import { localCalendarMonth } from "../features/financials/financialDirectoryUtils";

/** Known Supabase RPC parity notices — not shown in the UI. */
function isInternalStatementWarning(message: string): boolean {
  return /materializeDueRecurringExpenses|applyDepositGrowthForCurrentPropertyLeases|Express statement may differ/i.test(
    message
  );
}

const EMPTY_METRICS: FinancialDirectoryMetrics = {
  receivedThisMonth: 0,
  expectedThisMonth: 0,
  expensesThisMonth: 0,
  bondThisMonth: 0,
  netCashFlow: 0,
  propertyCount: 0
};

function mapStatementRow(
  raw: Record<string, unknown>,
  propertyId: string,
  propertyName: string
): FinancialStatementRow {
  return {
    id: `${propertyId}:${String(raw.id ?? "")}`,
    propertyId,
    propertyName,
    date: String(raw.date ?? ""),
    description: String(raw.description ?? ""),
    type: String(raw.type ?? ""),
    debit: raw.debit != null ? Number(raw.debit) : null,
    credit: raw.credit != null ? Number(raw.credit) : null,
    balance: raw.balance != null ? Number(raw.balance) : null,
    source: String(raw.source ?? ""),
    sourceId: raw.sourceId != null ? String(raw.sourceId) : null,
    status: String(raw.status ?? ""),
    invoiceNumber: raw.invoiceNumber != null ? String(raw.invoiceNumber) : null,
    expenseCategory: raw.expenseCategory != null ? String(raw.expenseCategory) : null
  };
}

/**
 * Portfolio-wide financial directory: merges each property's monthly statement RPC
 * (full ledger rows + calendar-month summary).
 */
export async function getFinancialsDirectory(opts?: {
  month?: string;
  propertyId?: string | null;
}): Promise<FinancialsDirectoryResult> {
  const month = opts?.month && /^\d{4}-\d{2}$/.test(opts.month) ? opts.month : localCalendarMonth();
  const filterPropertyId = opts?.propertyId && opts.propertyId !== "ALL" ? String(opts.propertyId) : null;

  const props = await listProperties();
  const propertyList = props.map((p) => ({
    id: String(p.id),
    name: String(p.name ?? "Property")
  }));

  const targets = filterPropertyId
    ? propertyList.filter((p) => p.id === filterPropertyId)
    : propertyList;

  const uuidTargets = targets
    .map((p) => ({ ...p, uuid: supabaseStatementPropertyId(p.id) }))
    .filter((p): p is { id: string; name: string; uuid: string } => p.uuid != null);

  const warnings: string[] = [];
  if (filterPropertyId && uuidTargets.length === 0) {
    return { items: [], metrics: EMPTY_METRICS, properties: propertyList, warnings: ["Property not found."] };
  }

  const statements = await Promise.all(
    uuidTargets.map(async (p) => {
      try {
        const st = await getPropertyMonthlyStatement(p.uuid, { month, includeExpected: true });
        return { property: p, statement: st, error: null as string | null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { property: p, statement: null, error: msg };
      }
    })
  );

  const items: FinancialStatementRow[] = [];
  const metrics: FinancialDirectoryMetrics = { ...EMPTY_METRICS, propertyCount: uuidTargets.length };

  for (const { property, statement, error } of statements) {
    if (error) {
      warnings.push(`${property.name}: ${error}`);
      continue;
    }
    if (!statement) continue;

    const stmtWarnings = statement.warnings;
    if (Array.isArray(stmtWarnings)) {
      for (const w of stmtWarnings) {
        if (typeof w === "string" && w.trim() && !isInternalStatementWarning(w)) {
          warnings.push(`${property.name}: ${w}`);
        }
      }
    }

    const summary = (statement.summary ?? {}) as Record<string, unknown>;
    metrics.receivedThisMonth += Number(summary.receivedThisMonth ?? 0);
    metrics.expectedThisMonth += Number(summary.expectedThisMonth ?? 0);
    metrics.expensesThisMonth += Number(summary.expensesThisMonth ?? 0);
    metrics.bondThisMonth += Number(summary.bondThisMonth ?? 0);
    metrics.netCashFlow += Number(summary.netCashFlow ?? 0);

    const rows = (statement.statementRows ?? []) as Record<string, unknown>[];
    for (const row of rows) {
      items.push(mapStatementRow(row, property.id, property.name));
    }
  }

  items.sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return a.propertyName.localeCompare(b.propertyName);
  });

  return { items, metrics, properties: propertyList, warnings };
}
