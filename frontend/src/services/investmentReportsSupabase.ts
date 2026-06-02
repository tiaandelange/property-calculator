import { getSupabase } from "../lib/supabaseClient";
import { requireUserId } from "./profileSupabase";

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object" && "message" in e) return new Error(String((e as any).message));
  return new Error(String(e));
}

function isMissingTableError(err: unknown, table: string): boolean {
  const e = err as { code?: unknown; message?: unknown };
  const msg = String(e?.message ?? "");
  return String(e?.code ?? "") === "PGRST205" || (msg.includes("schema cache") && msg.includes(table));
}

function isPermissionDeniedError(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown };
  return String(e?.code ?? "") === "42501" || String(e?.message ?? "").toLowerCase().includes("permission denied");
}

/** Derive calculator property type slug from `investment-report-<type>.pdf`. */
export function propertyTypeFromInvestmentReportFileName(fileName: string): string {
  const base = fileName
    .trim()
    .replace(/^investment-report-/i, "")
    .replace(/\.pdf$/i, "")
    .trim();
  return base || "investment";
}

export type InvestmentReportRow = {
  id: string;
  createdAt: string;
  fileName: string;
  label: string | null;
  propertyType: string;
  storageBucket: string;
  storageKey: string;
};

function mapInvestmentReportRow(r: {
  id: unknown;
  created_at?: unknown;
  file_name?: unknown;
  label?: unknown;
  property_type?: unknown;
  storage_bucket?: unknown;
  storage_key?: unknown;
}): InvestmentReportRow {
  const fileName = String(r.file_name ?? "investment-report.pdf");
  return {
    id: String(r.id),
    createdAt: String(r.created_at ?? ""),
    fileName,
    label: r.label != null ? String(r.label) : null,
    propertyType: String(r.property_type ?? propertyTypeFromInvestmentReportFileName(fileName)),
    storageBucket: String(r.storage_bucket ?? "reports"),
    storageKey: String(r.storage_key ?? "")
  };
}

function mapLegacyStoredInvestmentReportRow(r: {
  id: unknown;
  created_at?: unknown;
  file_name?: unknown;
  scenario_name?: unknown;
  storage_bucket?: unknown;
  storage_key?: unknown;
}): InvestmentReportRow {
  const fileName = String(r.file_name ?? "investment-report.pdf");
  return {
    id: String(r.id),
    createdAt: String(r.created_at ?? ""),
    fileName,
    label: r.scenario_name != null ? String(r.scenario_name) : null,
    propertyType: propertyTypeFromInvestmentReportFileName(fileName),
    storageBucket: String(r.storage_bucket ?? "reports"),
    storageKey: String(r.storage_key ?? "")
  };
}

async function listLegacyInvestmentReportsFromStoredReports(uid: string): Promise<InvestmentReportRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("stored_reports")
    .select("id, created_at, file_name, scenario_name, storage_bucket, storage_key")
    .eq("user_id", uid)
    .eq("report_type", "INVESTMENT_REPORT")
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  return (data ?? []).map(mapLegacyStoredInvestmentReportRow);
}

export async function listInvestmentReports(): Promise<InvestmentReportRow[]> {
  const uid = await requireUserId();
  const sb = getSupabase();

  let primary: InvestmentReportRow[] = [];
  let useLegacyOnly = false;

  const { data, error } = await sb
    .from("investment_reports")
    .select("id, created_at, file_name, label, property_type, storage_bucket, storage_key")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error, "investment_reports") || isPermissionDeniedError(error)) {
      useLegacyOnly = true;
    } else {
      throw toError(error);
    }
  } else {
    primary = (data ?? []).map(mapInvestmentReportRow);
  }

  if (useLegacyOnly) {
    return listLegacyInvestmentReportsFromStoredReports(uid);
  }

  if (primary.length > 0) {
    return primary;
  }

  return listLegacyInvestmentReportsFromStoredReports(uid);
}

export async function getInvestmentReportSignedUrl(report: { storageBucket: string; storageKey: string }): Promise<string | null> {
  const sb = getSupabase();
  if (!report.storageBucket || !report.storageKey) return null;
  const { data, error } = await sb.storage.from(report.storageBucket).createSignedUrl(report.storageKey, 600);
  if (error) throw toError(error);
  return data?.signedUrl ?? null;
}

export async function deleteInvestmentReport(reportId: string): Promise<void> {
  const uid = await requireUserId();
  const sb = getSupabase();

  const { data: row, error: selErr } = await sb
    .from("investment_reports")
    .select("id, storage_bucket, storage_key")
    .eq("id", reportId)
    .eq("user_id", uid)
    .maybeSingle();

  if (selErr && !isMissingTableError(selErr, "investment_reports") && !isPermissionDeniedError(selErr)) {
    throw toError(selErr);
  }

  if (row) {
    const bucket = (row as { storage_bucket: string | null }).storage_bucket;
    const key = (row as { storage_key: string | null }).storage_key;
    if (bucket && key) {
      await sb.storage.from(bucket).remove([key]);
    }
    const { error: delErr } = await sb.from("investment_reports").delete().eq("id", reportId).eq("user_id", uid);
    if (delErr) throw toError(delErr);
    return;
  }

  const { data: fbRow, error: fbSelErr } = await sb
    .from("stored_reports")
    .select("id, storage_bucket, storage_key")
    .eq("id", reportId)
    .eq("user_id", uid)
    .eq("report_type", "INVESTMENT_REPORT")
    .maybeSingle();
  if (fbSelErr) throw toError(fbSelErr);
  if (!fbRow) throw new Error("Report not found.");

  const bucket = (fbRow as { storage_bucket: string | null }).storage_bucket;
  const key = (fbRow as { storage_key: string | null }).storage_key;
  if (bucket && key) {
    await sb.storage.from(bucket).remove([key]);
  }
  const { error: fbDelErr } = await sb
    .from("stored_reports")
    .delete()
    .eq("id", reportId)
    .eq("user_id", uid)
    .eq("report_type", "INVESTMENT_REPORT");
  if (fbDelErr) throw toError(fbDelErr);
}
