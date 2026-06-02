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

type LocalRow = SavedCalculatorInput;

function isMissingTableError(err: unknown, table: string): boolean {
  const e = err as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const msg = String(e?.message ?? "");
  return String(e?.code ?? "") === "PGRST205" || (msg.includes("schema cache") && msg.includes(table));
}

function localKey(uid: string, propertyType?: PropertyTypeId): string {
  return `pg.calcSavedInputs.v1.${uid}.${propertyType ?? "all"}`;
}

function readLocal(uid: string, propertyType: PropertyTypeId): LocalRow[] {
  try {
    const raw = localStorage.getItem(localKey(uid, propertyType));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r: any) => ({
        id: String(r?.id ?? ""),
        propertyType,
        label: r?.label != null ? String(r.label) : null,
        createdAt: String(r?.createdAt ?? r?.created_at ?? ""),
        answers: r?.answers && typeof r.answers === "object" ? Object.fromEntries(Object.entries(r.answers).map(([k, v]) => [k, v == null ? "" : String(v)])) : {}
      }))
      .filter((r: LocalRow) => Boolean(r.id));
  } catch {
    return [];
  }
}

function writeLocal(uid: string, propertyType: PropertyTypeId, rows: LocalRow[]): void {
  try {
    localStorage.setItem(localKey(uid, propertyType), JSON.stringify(rows));
  } catch {
    // ignore
  }
}

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
  if (error) {
    // Migration not yet applied → fall back to localStorage (per-user + per-property-type).
    if (isMissingTableError(error, "calculator_saved_inputs")) {
      const id = crypto.randomUUID();
      const row: LocalRow = {
        id,
        propertyType: opts.propertyType,
        label: opts.label?.trim() ? opts.label.trim() : null,
        createdAt: new Date().toISOString(),
        answers: opts.answers
      };
      const existing = readLocal(uid, opts.propertyType);
      writeLocal(uid, opts.propertyType, [row, ...existing].slice(0, 50));
      return { id };
    }
    throw toError(error);
  }
  return { id: String((data as { id?: unknown } | null)?.id ?? "") };
}

export async function listSavedCalculatorInputs(propertyType?: PropertyTypeId): Promise<SavedCalculatorInput[]> {
  const sb = getSupabase();
  const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
  if (sessionErr) throw toError(sessionErr);
  const uid = sessionData.session?.user?.id;
  if (!uid) throw new Error("Please sign in to load saved inputs.");

  let q = sb
    .from("calculator_saved_inputs")
    .select("id,user_id,property_type,label,payload,created_at")
    .order("created_at", { ascending: false });
  if (propertyType) q = q.eq("property_type", propertyType);
  const { data, error } = await q;
  if (error) {
    if (propertyType && isMissingTableError(error, "calculator_saved_inputs")) {
      return readLocal(uid, propertyType);
    }
    throw toError(error);
  }
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
  if (error) {
    if (isMissingTableError(error, "calculator_saved_inputs")) {
      const { data: sessionData } = await sb.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return;
      // Best-effort local delete: try all known types.
      const types: PropertyTypeId[] = [
        "single-family",
        "duplex",
        "apartment",
        "multi-family",
        "student-housing",
        "airbnb",
        "commercial",
        "vacant-land"
      ];
      for (const t of types) {
        const existing = readLocal(uid, t);
        const next = existing.filter((r) => r.id !== id);
        if (next.length !== existing.length) writeLocal(uid, t, next);
      }
      return;
    }
    throw toError(error);
  }
}

