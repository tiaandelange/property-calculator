import { ZodError } from "zod";
import { calculate } from "@calculatorShared/calculatorEngine";
import type { CalculatorResult } from "@calculatorShared/calculatorTypes";
import { getSupabase } from "../lib/supabaseClient";

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object") {
    const pe = e as {
      message?: string;
      hint?: string;
      details?: string;
      code?: string;
      statusCode?: string | number;
    };
    const parts = [
      pe.message,
      pe.details,
      pe.hint,
      pe.code != null && pe.code !== "" ? `code=${pe.code}` : undefined,
      pe.statusCode != null ? `status=${pe.statusCode}` : undefined
    ].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return new Error(String(e));
}

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

export type SavedCalculationReportRow = {
  id: string;
  type: string;
  created_at: string;
  hasPdf: boolean;
  reportId: string | null;
  downloadUrl: string | null;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
};

/** Pure deterministic math + validation (same engine as Express `POST /api/calculations/:type`). */
export function runCalculatorLocally(type: string, input: Record<string, unknown>): CalculatorResult {
  try {
    return calculate(type, input) as CalculatorResult;
  } catch (e) {
    if (e instanceof ZodError) {
      const err = new Error("Invalid calculator inputs");
      (err as Error & { issues?: typeof e.issues }).issues = e.issues;
      throw err;
    }
    throw e;
  }
}

/**
 * Persist run + apply free-use / subscription rules (Postgres RPC; SECURITY DEFINER).
 * Caller must be signed in.
 */
export async function saveCalculationResult(
  type: string,
  input: Record<string, unknown>,
  result: CalculatorResult
): Promise<{
  id: string;
  freeUsesRemaining: number | null;
  type: string;
  input: Record<string, unknown>;
  result: CalculatorResult;
}> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("save_calculation_and_decrement_free_use", {
    p_type: type,
    p_input: input,
    p_result: result
  });
  if (error) throw toError(error);
  const row = data as Record<string, unknown> | null;
  if (!row || typeof row !== "object") throw new Error("Empty save response.");
  const freeRaw = row.freeUsesRemaining;
  let freeUsesRemaining: number | null = null;
  if (freeRaw !== null && freeRaw !== undefined && typeof freeRaw === "number" && Number.isFinite(freeRaw)) {
    freeUsesRemaining = freeRaw;
  } else if (typeof freeRaw === "string" && freeRaw.trim() !== "" && Number.isFinite(Number(freeRaw))) {
    freeUsesRemaining = Number(freeRaw);
  }
  return {
    id: String(row.id ?? ""),
    type: String(row.type ?? type),
    input: asObject(row.input ?? input),
    result: asObject(row.result ?? result) as unknown as CalculatorResult,
    freeUsesRemaining
  };
}

/** Saved runs for the signed-in user (workspace dashboard). */
export async function listCalculationResults(): Promise<SavedCalculationReportRow[]> {
  const sb = getSupabase();
  const { data: sessionData, error: sessionErr } = await sb.auth.getUser();
  if (sessionErr) throw toError(sessionErr);
  const uid = sessionData.user?.id;
  if (!uid) throw new Error("Not signed in.");

  const { data: calcs, error: e1 } = await sb
    .from("calculator_results")
    .select("id,type,created_at,input_json,result_json")
    .order("created_at", { ascending: false });

  if (e1) throw toError(e1);

  const rows = (calcs ?? []) as Array<{
    id: string;
    type: string;
    created_at: string;
    input_json: unknown;
    result_json: unknown;
  }>;

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const { data: reports, error: e2 } = await sb
    .from("stored_reports")
    .select("id,calculation_id,file_name,created_at,storage_bucket,storage_key")
    .eq("user_id", uid)
    .in("calculation_id", ids)
    .order("created_at", { ascending: false });

  if (e2) throw toError(e2);

  const latestPdf = new Map<
    string,
    { id: string; file_name: string; storage_bucket: string | null; storage_key: string | null }
  >();
  for (const s of reports ?? []) {
    const cid = s.calculation_id as string | null;
    if (cid && !latestPdf.has(cid)) {
      latestPdf.set(cid, {
        id: String(s.id),
        file_name: String(s.file_name),
        storage_bucket: (s.storage_bucket as string | null) ?? null,
        storage_key: (s.storage_key as string | null) ?? null
      });
    }
  }

  return Promise.all(
    rows.map(async (r) => {
      const pdf = latestPdf.get(r.id);
      let downloadUrl: string | null = null;
      if (pdf?.storage_bucket && pdf.storage_key) {
        const { data: signed, error: signErr } = await sb.storage
          .from(pdf.storage_bucket)
          .createSignedUrl(pdf.storage_key, 600);
        if (!signErr && signed?.signedUrl) downloadUrl = signed.signedUrl;
      } else if (pdf) {
        downloadUrl = `/api/reports/${pdf.id}/download`;
      }
      return {
        id: r.id,
        type: r.type,
        created_at: r.created_at,
        hasPdf: Boolean(pdf),
        reportId: pdf?.id ?? null,
        downloadUrl,
        input: asObject(r.input_json),
        result: asObject(r.result_json)
      };
    })
  );
}

export async function deleteCalculationResult(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("calculator_results").delete().eq("id", id);
  if (error) throw toError(error);
}
