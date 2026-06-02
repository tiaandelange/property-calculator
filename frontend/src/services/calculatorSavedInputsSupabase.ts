import { getSupabase } from "../lib/supabaseClient";
import type { PropertyTypeId } from "../data/calculatorPropertyTypes";

type Row = {
  id: string;
  user_id: string;
  property_type: string;
  label: string | null;
  payload: unknown;
  created_at: string;
};

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object") {
    const pe = e as { message?: string; hint?: string; details?: string; code?: string };
    const parts = [pe.message, pe.details, pe.hint, pe.code ? `code=${pe.code}` : undefined].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return new Error(String(e));
}

export type SavedCalculatorInput = {
  id: string;
  propertyType: PropertyTypeId;
  label: string | null;
  createdAt: string;
  answers: Record<string, string>;
};

function parseAnswers(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as { answers?: unknown };
  const a = p.answers;
  if (!a || typeof a !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(a as Record<string, unknown>)) {
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

export async function saveCalculatorInputs(opts: {
  propertyType: PropertyTypeId;
  label?: string | null;
  answers: Record<string, string>;
}): Promise<{ id: string }> {
  const sb = getSupabase();
  const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
  if (sessionErr) throw toError(sessionErr);
  const uid = sessionData.session?.user?.id;
  if (!uid) throw new Error("Please sign in to save inputs.");

  const { data, error } = await sb
    .from("calculator_saved_inputs")
    .insert({
      user_id: uid,
      property_type: opts.propertyType,
      label: opts.label?.trim() ? opts.label.trim() : null,
      payload: { answers: opts.answers }
    })
    .select("id")
    .single();
  if (error) throw toError(error);
  return { id: String((data as { id?: unknown } | null)?.id ?? "") };
}

export async function listSavedCalculatorInputs(propertyType?: PropertyTypeId): Promise<SavedCalculatorInput[]> {
  const sb = getSupabase();
  let q = sb
    .from("calculator_saved_inputs")
    .select("id,user_id,property_type,label,payload,created_at")
    .order("created_at", { ascending: false });
  if (propertyType) q = q.eq("property_type", propertyType);
  const { data, error } = await q;
  if (error) throw toError(error);
  const rows = (data ?? []) as Row[];
  return rows
    .map((r) => ({
      id: r.id,
      propertyType: r.property_type as PropertyTypeId,
      label: r.label,
      createdAt: r.created_at,
      answers: parseAnswers(r.payload)
    }))
    .filter((r) => Boolean(r.id && r.propertyType));
}

export async function deleteSavedCalculatorInput(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("calculator_saved_inputs").delete().eq("id", id);
  if (error) throw toError(error);
}

