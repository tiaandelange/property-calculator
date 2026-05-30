import { dbInvoiceBundleToClient } from "../api/invoiceRowMapping";
import { getSupabase } from "../lib/supabaseClient";
import { utcCalendarMonthBounds } from "../utils/financialMonthBounds";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object" && "message" in e) {
    const pe = e as { message?: string; hint?: string; details?: string };
    const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return new Error(String(e));
}

/** Property workspace routes use UUID ids when Supabase is authoritative. */
export function supabaseStatementPropertyId(id: string | number): string | null {
  const s = String(id).trim();
  return UUID_RE.test(s) ? s : null;
}

/**
 * Calendar month for `get_property_monthly_statement` — same UTC interpretation as
 * Express `utcCalendarMonthBounds` + `buildPropertyStatement`.
 */
export function calendarMonthPartsForStatementRpc(
  month: string | null | undefined,
  fallbackInstant: Date = new Date()
): { year: number; month: number } {
  const { start } = utcCalendarMonthBounds(month ?? null, fallbackInstant);
  return { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1 };
}

function normalizeStatementRpcPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const inv = raw.currentInvoice;
  let currentInvoice: Record<string, unknown> | null = null;
  if (inv && typeof inv === "object" && !Array.isArray(inv)) {
    currentInvoice = dbInvoiceBundleToClient(inv as Record<string, unknown>);
  }
  return { ...raw, currentInvoice };
}

/**
 * Monthly property statement (Financials / Overview) via Postgres RPC.
 * Bond preview / backfill remain on Express (`ownedProperties` bond helpers).
 */
export async function getPropertyMonthlyStatement(
  propertyId: string,
  opts?: { month?: string | null; includeExpected?: boolean; bustCache?: boolean }
): Promise<Record<string, unknown>> {
  const uuid = supabaseStatementPropertyId(propertyId);
  if (!uuid) throw new Error("Property id must be a UUID when loading statements from Supabase.");

  const { year, month } = calendarMonthPartsForStatementRpc(opts?.month ?? null, new Date());
  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_property_monthly_statement", {
    p_property_id: uuid,
    p_year: year,
    p_month: month,
    p_include_expected: opts?.includeExpected !== false
  });
  if (error) throw toError(error);
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Empty statement response.");
  }
  return normalizeStatementRpcPayload(data as Record<string, unknown>);
}

export type PropertyStatementRangeParams = {
  startDate: string;
  endDate: string;
  includeExpected?: boolean;
};

/**
 * Property statement ledger for an inclusive UTC date range (Statement tab).
 */
export async function getPropertyStatementRange(
  propertyId: string,
  params: PropertyStatementRangeParams
): Promise<Record<string, unknown>> {
  const uuid = supabaseStatementPropertyId(propertyId);
  if (!uuid) throw new Error("Property id must be a UUID when loading statements from Supabase.");

  const startDate = String(params.startDate ?? "").trim().slice(0, 10);
  const endDate = String(params.endDate ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("Statement range requires startDate and endDate (YYYY-MM-DD).");
  }

  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_property_statement_range", {
    p_property_id: uuid,
    p_start_date: startDate,
    p_end_date: endDate,
    p_include_expected: params.includeExpected !== false
  });
  if (error) throw toError(error);
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Empty statement range response.");
  }
  return data as Record<string, unknown>;
}
