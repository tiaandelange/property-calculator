import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";

export type PortfolioProjectionMetrics = {
  rentalIncomeGrowthPercentAnnual: number;
  totalExpensesGrowthPercentAnnual: number;
};

export type PortfolioProjectionMetricsResponse = {
  metrics: PortfolioProjectionMetrics;
  description: string;
};

export type AdminStatusResponse = {
  message: string;
};

const PROJECTION_DESCRIPTION =
  "These rates project future rental income and total expenses when calculating portfolio IRR. Property value growth still uses each property's expected annual appreciation %.";

const DEFAULTS_SELECT =
  "id, rental_income_growth_percent_annual, total_expenses_growth_percent_annual" as const;

type DefaultsRow = {
  id: string;
  rental_income_growth_percent_annual: number;
  total_expenses_growth_percent_annual: number;
};

function toError(e: PostgrestError | Error): Error {
  if (e instanceof Error) return e;
  const pe = e as PostgrestError;
  const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
  const msg = parts.join(" — ") || "Database request failed.";
  if (pe.code === "42501" || /permission denied|row-level security/i.test(msg)) {
    return new Error("Forbidden: admin access required");
  }
  return new Error(msg);
}

function clampGrowthPercent(x: number): number {
  return Math.min(50, Math.max(-50, x));
}

function rowToMetrics(row: DefaultsRow): PortfolioProjectionMetrics {
  return {
    rentalIncomeGrowthPercentAnnual: row.rental_income_growth_percent_annual,
    totalExpensesGrowthPercentAnnual: row.total_expenses_growth_percent_annual
  };
}

async function requireUserId(): Promise<string> {
  try {
    return await requireUserIdFromSession();
  } catch (e) {
    throw toError(e instanceof Error ? e : new Error(String(e)));
  }
}

/** Returns true when `profiles.role` is ADMIN for the signed-in user. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (error) throw toError(error);
  return data?.role === "ADMIN";
}

async function assertCurrentUserAdmin(): Promise<void> {
  if (!(await isCurrentUserAdmin())) {
    throw new Error("Forbidden: admin access required");
  }
}

async function fetchDefaultsRow(): Promise<DefaultsRow> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("portfolio_projection_defaults")
    .select(DEFAULTS_SELECT)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw toError(error);
  if (!data) {
    throw new Error(
      "Portfolio projection defaults are missing. Apply Supabase migrations (seed row in portfolio_projection_defaults)."
    );
  }
  return data as DefaultsRow;
}

/** Verifies the signed-in user is an admin (`profiles.role = 'ADMIN'`). */
export async function getAdminStatus(): Promise<AdminStatusResponse> {
  await assertCurrentUserAdmin();
  return { message: "Admin access granted" };
}

/** Loads global projection growth rates (admin-only in the SPA; table readable by all authenticated via RLS). */
export async function getPortfolioProjectionMetrics(): Promise<PortfolioProjectionMetricsResponse> {
  await assertCurrentUserAdmin();
  const row = await fetchDefaultsRow();
  return { metrics: rowToMetrics(row), description: PROJECTION_DESCRIPTION };
}

/** Updates projection defaults; RLS allows only ADMIN profiles to UPDATE. */
export async function updatePortfolioProjectionMetrics(
  patch: Partial<PortfolioProjectionMetrics>
): Promise<{ metrics: PortfolioProjectionMetrics }> {
  await assertCurrentUserAdmin();

  const row = await fetchDefaultsRow();
  const update: Record<string, number | string> = {
    updated_at: new Date().toISOString()
  };

  if (
    patch.rentalIncomeGrowthPercentAnnual != null &&
    Number.isFinite(patch.rentalIncomeGrowthPercentAnnual)
  ) {
    update.rental_income_growth_percent_annual = clampGrowthPercent(patch.rentalIncomeGrowthPercentAnnual);
  }
  if (
    patch.totalExpensesGrowthPercentAnnual != null &&
    Number.isFinite(patch.totalExpensesGrowthPercentAnnual)
  ) {
    update.total_expenses_growth_percent_annual = clampGrowthPercent(patch.totalExpensesGrowthPercentAnnual);
  }

  if (Object.keys(update).length === 1) {
    return { metrics: rowToMetrics(row) };
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from("portfolio_projection_defaults")
    .update(update)
    .eq("id", row.id)
    .select(DEFAULTS_SELECT)
    .single();

  if (error) throw toError(error);
  return { metrics: rowToMetrics(data as DefaultsRow) };
}
