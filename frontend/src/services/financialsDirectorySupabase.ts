import { listPropertyOptions } from "./propertiesSupabase";
import { calendarMonthPartsForStatementRpc, supabaseStatementPropertyId } from "./statementsSupabase";
import { getSupabase } from "../lib/supabaseClient";
import type {
  FinancialDirectoryMetrics,
  FinancialStatementRow,
  FinancialsDirectoryResult
} from "../features/financials/financialDirectoryTypes";
import { FINANCIALS_PAGE_SIZE, localCalendarMonth } from "../features/financials/financialDirectoryUtils";

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object" && "message" in e) {
    const pe = e as { message?: string; hint?: string; details?: string };
    const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return new Error(String(e));
}

const EMPTY_METRICS: FinancialDirectoryMetrics = {
  receivedThisMonth: 0,
  expectedThisMonth: 0,
  expensesThisMonth: 0,
  bondThisMonth: 0,
  netCashFlow: 0,
  propertyCount: 0
};

function mapStatementRow(raw: Record<string, unknown>): FinancialStatementRow {
  return {
    id: String(raw.id ?? ""),
    propertyId: String(raw.propertyId ?? ""),
    propertyName: String(raw.propertyName ?? ""),
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
    invoiceId: raw.invoiceId != null ? String(raw.invoiceId) : null,
    statementType: raw.statementType != null ? String(raw.statementType) : null,
    tenantId: raw.tenantId != null ? String(raw.tenantId) : null,
    expenseCategory: raw.expenseCategory != null ? String(raw.expenseCategory) : null
  };
}

export type FinancialsDirectoryQueryOpts = {
  month?: string;
  propertyId?: string | null;
  page?: number;
  pageSize?: number;
  q?: string;
  source?: string;
};

/**
 * Portfolio-wide financial directory via single batch RPC
 * (replaces N parallel get_property_monthly_statement client calls).
 */
export async function getFinancialsDirectory(opts?: FinancialsDirectoryQueryOpts): Promise<
  FinancialsDirectoryResult & {
    totalCount: number;
    ytd: { year: number; revenue: number; expenses: number; net: number; periodLabel: string };
  }
> {
  const month = opts?.month && /^\d{4}-\d{2}$/.test(opts.month) ? opts.month : localCalendarMonth();
  const filterPropertyId = opts?.propertyId && opts.propertyId !== "ALL" ? String(opts.propertyId) : null;
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? FINANCIALS_PAGE_SIZE);
  const offset = (page - 1) * pageSize;
  const { year, month: monthNum } = calendarMonthPartsForStatementRpc(month, new Date());

  const propertyUuid =
    filterPropertyId != null ? supabaseStatementPropertyId(filterPropertyId) : null;
  if (filterPropertyId && !propertyUuid) {
    const properties = (await listPropertyOptions()).map((p) => ({
      id: String(p.id),
      name: String(p.name ?? "Property")
    }));
    return {
      items: [],
      totalCount: 0,
      metrics: EMPTY_METRICS,
      properties,
      warnings: ["Property not found."],
      ytd: { year: new Date().getFullYear(), revenue: 0, expenses: 0, net: 0, periodLabel: "" }
    };
  }

  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_workspace_financials_directory", {
    p_year: year,
    p_month: monthNum,
    p_property_id: propertyUuid,
    p_limit: pageSize,
    p_offset: offset,
    p_search: opts?.q?.trim() || null,
    p_source: opts?.source && opts.source !== "ALL" ? opts.source : null
  });
  if (error) throw toError(error);
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Empty financials directory response.");
  }

  const payload = data as Record<string, unknown>;
  const rawItems = (payload.items ?? []) as Record<string, unknown>[];
  const rawMetrics = (payload.metrics ?? {}) as Record<string, unknown>;
  const rawProperties = (payload.properties ?? []) as Array<{ id?: string; name?: string }>;
  const rawYtd = (payload.ytd ?? {}) as Record<string, unknown>;
  const warningsRaw = payload.warnings;
  const warnings = Array.isArray(warningsRaw)
    ? warningsRaw.map(String).filter(Boolean)
    : [];

  const ytdYear = Number(rawYtd.year ?? new Date().getFullYear());
  const ytdLatest = String(rawYtd.latestDate ?? new Date().toISOString().slice(0, 10));
  const ytdStart = `${ytdYear}-01-01`;
  const fmtPeriod = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  return {
    items: rawItems.map((r) => mapStatementRow(r)),
    totalCount: Number(payload.totalCount ?? 0),
    metrics: {
      receivedThisMonth: Number(rawMetrics.receivedThisMonth ?? 0),
      expectedThisMonth: Number(rawMetrics.expectedThisMonth ?? 0),
      expensesThisMonth: Number(rawMetrics.expensesThisMonth ?? 0),
      bondThisMonth: Number(rawMetrics.bondThisMonth ?? 0),
      netCashFlow: Number(rawMetrics.netCashFlow ?? 0),
      propertyCount: Number(rawMetrics.propertyCount ?? 0)
    },
    properties: rawProperties.map((p) => ({
      id: String(p.id ?? ""),
      name: String(p.name ?? "Property")
    })),
    warnings,
    ytd: {
      year: ytdYear,
      revenue: Number(rawYtd.revenue ?? 0),
      expenses: Number(rawYtd.expenses ?? 0),
      net: Number(rawYtd.net ?? 0),
      periodLabel: `${fmtPeriod(ytdStart)} – ${fmtPeriod(ytdLatest)}`
    }
  };
}
