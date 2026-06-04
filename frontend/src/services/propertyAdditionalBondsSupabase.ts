import type { PostgrestError } from "@supabase/supabase-js";
import { requireUserIdFromSession } from "../lib/authSession";
import { getSupabase } from "../lib/supabaseClient";

export type PropertyAdditionalBond = {
  id: string;
  propertyId: string;
  description: string;
  outstandingBalance: number | null;
  monthlyPayment: number | null;
  bondAnnualInterestRatePercent: number | null;
  bondTermYears: number | null;
  bondStartDate: string | null;
  bondRemainingTermMonths: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type PropertyAdditionalBondInput = {
  description: string;
  outstandingBalance?: number | null;
  monthlyPayment?: number | null;
  bondAnnualInterestRatePercent?: number | null;
  bondTermYears?: number | null;
  bondStartDate?: string | null;
  bondRemainingTermMonths?: number | null;
};

function toError(e: PostgrestError | Error): Error {
  if ("code" in e && "message" in e) {
    const pe = e as PostgrestError;
    return new Error([pe.message, pe.hint, pe.details].filter(Boolean).join(" — ") || "Database request failed.");
  }
  return e instanceof Error ? e : new Error(String(e));
}

async function requireUserId(): Promise<string> {
  try {
    return await requireUserIdFromSession();
  } catch (e) {
    throw toError(e instanceof Error ? e : new Error(String(e)));
  }
}

function rowToBond(row: Record<string, unknown>): PropertyAdditionalBond {
  return {
    id: String(row.id),
    propertyId: String(row.property_id),
    description: String(row.description ?? ""),
    outstandingBalance: row.outstanding_balance != null ? Number(row.outstanding_balance) : null,
    monthlyPayment: row.monthly_payment != null ? Number(row.monthly_payment) : null,
    bondAnnualInterestRatePercent:
      row.annual_interest_rate_percent != null ? Number(row.annual_interest_rate_percent) : null,
    bondTermYears: row.bond_term_years != null ? Number(row.bond_term_years) : null,
    bondStartDate: row.bond_start_date != null ? String(row.bond_start_date).slice(0, 10) : null,
    bondRemainingTermMonths:
      row.bond_remaining_term_months != null ? Number(row.bond_remaining_term_months) : null,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: row.is_active !== false
  };
}

function inputToRow(
  propertyId: string,
  userId: string,
  input: PropertyAdditionalBondInput,
  sortOrder: number
): Record<string, unknown> {
  return {
    property_id: propertyId,
    user_id: userId,
    description: String(input.description ?? "").trim(),
    outstanding_balance: input.outstandingBalance ?? null,
    monthly_payment: input.monthlyPayment ?? null,
    annual_interest_rate_percent: input.bondAnnualInterestRatePercent ?? null,
    bond_term_years: input.bondTermYears ?? null,
    bond_start_date: input.bondStartDate ?? null,
    bond_remaining_term_months: input.bondRemainingTermMonths ?? null,
    sort_order: sortOrder,
    is_active: true,
    updated_at: new Date().toISOString()
  };
}

export async function listPropertyAdditionalBonds(propertyId: string): Promise<PropertyAdditionalBond[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("property_additional_bonds")
    .select("*")
    .eq("property_id", String(propertyId))
    .eq("user_id", uid)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw toError(error);
  return (data ?? []).map((r) => rowToBond(r as Record<string, unknown>));
}

export async function createPropertyAdditionalBond(
  propertyId: string,
  input: PropertyAdditionalBondInput
): Promise<PropertyAdditionalBond> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const existing = await listPropertyAdditionalBonds(propertyId);
  const row = inputToRow(String(propertyId), uid, input, existing.length);
  const { data, error } = await sb
    .from("property_additional_bonds")
    .insert({ ...row, created_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw toError(error);
  return rowToBond(data as Record<string, unknown>);
}

export async function updatePropertyAdditionalBond(
  bondId: string,
  input: PropertyAdditionalBondInput
): Promise<PropertyAdditionalBond> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data: existing, error: fetchErr } = await sb
    .from("property_additional_bonds")
    .select("property_id, sort_order")
    .eq("id", bondId)
    .eq("user_id", uid)
    .single();
  if (fetchErr) throw toError(fetchErr);

  const patch = inputToRow(
    String(existing.property_id),
    uid,
    input,
    Number(existing.sort_order ?? 0)
  );
  delete patch.property_id;
  delete patch.user_id;
  delete patch.sort_order;

  const { data, error } = await sb
    .from("property_additional_bonds")
    .update(patch)
    .eq("id", bondId)
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return rowToBond(data as Record<string, unknown>);
}

export async function deletePropertyAdditionalBond(bondId: string): Promise<void> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { error } = await sb.from("property_additional_bonds").delete().eq("id", bondId).eq("user_id", uid);
  if (error) throw toError(error);
}
