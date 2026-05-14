import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";

function toError(e: PostgrestError | Error | Record<string, unknown>): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object" && "message" in e) {
    const pe = e as unknown as PostgrestError;
    const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return new Error(String(e));
}

/** Returns a UUID string when `id` is a canonical UUID; otherwise null (Express numeric ids are not sent to Supabase RPC). */
export function supabaseDashboardPropertyId(id: string | number | null | undefined): string | null {
  if (id == null || id === "") return null;
  const s = String(id).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

/**
 * Portfolio dashboard summary via `public.get_dashboard_summary` (RLS + `auth.uid()` inside SQL).
 * Shape matches Express `GET /properties/dashboard-summary` where implemented; IRR blocks are deferred stubs.
 */
export async function getDashboardSummary(params?: {
  propertyTypes?: string[];
  propertyId?: string | number | null;
  month?: string | null;
  portfolioIrrHorizonYears?: number | null;
  /** Unused for RPC (no HTTP cache); kept for API parity with Express caller. */
  bustCache?: boolean;
}): Promise<Record<string, unknown>> {
  const sb = getSupabase();
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC";
  const p_property_id = supabaseDashboardPropertyId(params?.propertyId ?? null);
  const { data, error } = await sb.rpc("get_dashboard_summary", {
    p_month: params?.month?.trim() || null,
    p_property_types: params?.propertyTypes?.length ? params.propertyTypes : null,
    p_property_id,
    p_portfolio_irr_horizon_years:
      params?.portfolioIrrHorizonYears != null && Number.isFinite(params.portfolioIrrHorizonYears)
        ? Math.floor(Number(params.portfolioIrrHorizonYears))
        : null,
    p_iana_timezone: tz
  });
  if (error) throw toError(error);
  if (data == null || typeof data !== "object") throw new Error("Empty dashboard response.");
  return data as Record<string, unknown>;
}
