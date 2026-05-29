import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import type { PropertyUnitDraft } from "../features/properties/units/propertyUnitTypes";

function toError(e: PostgrestError | Error): Error {
  if ("code" in e && "message" in e) {
    const pe = e as PostgrestError;
    return new Error([pe.message, pe.hint, pe.details].filter(Boolean).join(" — ") || "Database request failed.");
  }
  return e instanceof Error ? e : new Error(String(e));
}

async function requireUserId(): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Not signed in.");
  return data.user.id;
}

function rowToDraft(row: Record<string, unknown>): PropertyUnitDraft {
  return {
    clientId: String(row.id),
    id: String(row.id),
    unitName: String(row.unit_name ?? ""),
    unitType: row.unit_type != null ? String(row.unit_type) : null,
    description: row.description != null ? String(row.description) : null,
    bedrooms: row.bedrooms != null ? Number(row.bedrooms) : null,
    bathrooms: row.bathrooms != null ? Number(row.bathrooms) : null,
    sizeSqm: row.size_sqm != null ? Number(row.size_sqm) : null,
    expectedRent: row.expected_rent != null ? Number(row.expected_rent) : null,
    rentFrequency: (String(row.rent_frequency ?? "monthly") as PropertyUnitDraft["rentFrequency"]) || "monthly",
    occupancyStatus: (String(row.occupancy_status ?? "vacant") as PropertyUnitDraft["occupancyStatus"]) || "vacant",
    sortOrder: Number(row.sort_order ?? 0),
    isActive: row.is_active !== false,
    notes: row.notes != null ? String(row.notes) : null
  };
}

function draftToRow(propertyId: string, userId: string, u: PropertyUnitDraft, index: number): Record<string, unknown> {
  return {
    property_id: propertyId,
    user_id: userId,
    unit_name: String(u.unitName ?? "").trim(),
    unit_type: u.unitType?.trim() ? u.unitType.trim() : null,
    description: u.description?.trim() ? u.description.trim() : null,
    bedrooms: u.bedrooms != null && Number.isFinite(Number(u.bedrooms)) ? Number(u.bedrooms) : null,
    bathrooms: u.bathrooms != null && Number.isFinite(Number(u.bathrooms)) ? Number(u.bathrooms) : null,
    size_sqm: u.sizeSqm != null && Number.isFinite(Number(u.sizeSqm)) ? Number(u.sizeSqm) : null,
    expected_rent: u.expectedRent != null && Number.isFinite(Number(u.expectedRent)) ? Number(u.expectedRent) : null,
    rent_frequency: u.rentFrequency ?? "monthly",
    occupancy_status: u.occupancyStatus ?? "vacant",
    sort_order: u.sortOrder ?? index,
    is_active: u.isActive !== false,
    notes: u.notes?.trim() ? u.notes.trim() : null,
    updated_at: new Date().toISOString()
  };
}

export async function listPropertyUnits(propertyId: string): Promise<PropertyUnitDraft[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("property_units")
    .select("*")
    .eq("property_id", String(propertyId))
    .eq("user_id", uid)
    .order("sort_order", { ascending: true });
  if (error) throw toError(error);
  return (data ?? []).map((r) => rowToDraft(r as Record<string, unknown>));
}

export async function syncPropertyUnits(
  propertyId: string,
  units: PropertyUnitDraft[],
  opts?: { deactivateMissing?: boolean }
): Promise<PropertyUnitDraft[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const pid = String(propertyId);
  const active = units.filter((u) => u.isActive !== false && String(u.unitName ?? "").trim());

  const existing = await listPropertyUnits(pid);
  const existingIds = new Set(existing.map((u) => u.id).filter(Boolean) as string[]);
  const keptIds = new Set<string>();

  for (let i = 0; i < active.length; i++) {
    const u = active[i];
    const row = draftToRow(pid, uid, { ...u, sortOrder: i }, i);
    if (u.id && existingIds.has(u.id)) {
      const { error } = await sb.from("property_units").update(row).eq("id", u.id).eq("user_id", uid);
      if (error) throw toError(error);
      keptIds.add(u.id);
    } else {
      const { data, error } = await sb.from("property_units").insert({ ...row, created_at: new Date().toISOString() }).select("*").single();
      if (error) throw toError(error);
      if (data?.id) keptIds.add(String(data.id));
    }
  }

  if (opts?.deactivateMissing !== false) {
    for (const ex of existing) {
      if (ex.id && !keptIds.has(ex.id)) {
        const { error } = await sb
          .from("property_units")
          .update({ is_active: false, occupancy_status: "inactive", updated_at: new Date().toISOString() })
          .eq("id", ex.id)
          .eq("user_id", uid);
        if (error) throw toError(error);
      }
    }
  }

  return listPropertyUnits(pid);
}
