import { getSupabase } from "../lib/supabaseClient";
import { isUuid } from "../utils/propertyIds";

function toError(e: { message?: string }): Error {
  return new Error(e.message || "Equity metrics request failed.");
}

export type EquityMetricRow = {
  id: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  province: string | null;
  purchasePrice: number | null;
  currentEstimatedValue: number | null;
  outstandingBondBalance: number | null;
  equity: number | null;
  updatedAt: string | null;
};

export async function listEquityMetrics(): Promise<{ properties: EquityMetricRow[] }> {
  const sb = getSupabase();
  const { data: sessionData, error: userErr } = await sb.auth.getSession();
  if (userErr) throw toError(userErr);
  const uid = sessionData.session?.user?.id;
  if (!uid) throw new Error("Not signed in.");

  const { data, error } = await sb
    .from("properties")
    .select(
      "id, name, address_line1, city, province, purchase_price, current_estimated_value, outstanding_bond_balance, updated_at"
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw toError(error);

  const properties = (data ?? []).map((row) => {
    const v = row.current_estimated_value != null ? Number(row.current_estimated_value) : null;
    const b = row.outstanding_bond_balance != null ? Number(row.outstanding_bond_balance) : null;
    return {
      id: row.id,
      name: row.name,
      addressLine1: row.address_line1,
      city: row.city,
      province: row.province,
      purchasePrice: row.purchase_price,
      currentEstimatedValue: v,
      outstandingBondBalance: b,
      equity: v != null && b != null ? v - b : null,
      updatedAt: row.updated_at
    };
  });

  return { properties };
}

export async function updateEquityMetrics(
  updates: Array<{ propertyId: string | number; currentEstimatedValue: number | null; outstandingBondBalance: number | null }>
): Promise<{ updatedCount: number }> {
  const sb = getSupabase();
  const { data: sessionData, error: userErr } = await sb.auth.getSession();
  if (userErr) throw toError(userErr);
  const uid = sessionData.session?.user?.id;
  if (!uid) throw new Error("Not signed in.");

  let updatedCount = 0;
  for (const u of updates) {
    const pid = String(u.propertyId);
    if (!isUuid(pid)) continue;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (u.currentEstimatedValue != null) {
      if (u.currentEstimatedValue < 0) throw new Error("currentEstimatedValue must be non-negative");
      patch.current_estimated_value = u.currentEstimatedValue;
    } else if (u.currentEstimatedValue === null) {
      patch.current_estimated_value = null;
    }
    if (u.outstandingBondBalance != null) {
      if (u.outstandingBondBalance < 0) throw new Error("outstandingBondBalance must be non-negative");
      patch.outstanding_bond_balance = u.outstandingBondBalance;
    } else if (u.outstandingBondBalance === null) {
      patch.outstanding_bond_balance = null;
    }

    const { error } = await sb.from("properties").update(patch).eq("id", pid).eq("user_id", uid);
    if (error) throw toError(error);
    updatedCount += 1;
  }

  return { updatedCount };
}
