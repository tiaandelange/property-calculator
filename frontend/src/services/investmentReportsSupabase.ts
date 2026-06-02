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

export type InvestmentReportRow = {
  id: string;
  createdAt: string;
  fileName: string;
  label: string | null;
  propertyType: string;
  storageBucket: string;
  storageKey: string;
};

export async function listInvestmentReports(): Promise<InvestmentReportRow[]> {
  const uid = await requireUserId();
  const sb = getSupabase();

  const { data, error } = await sb
    .from("investment_reports")
    .select("id, created_at, file_name, label, property_type, storage_bucket, storage_key")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) {
    // Migration not applied yet → fall back to stored_reports with report_type=INVESTMENT_REPORT
    if (isMissingTableError(error, "investment_reports")) {
      const { data: fallback, error: fbErr } = await sb
        .from("stored_reports")
        .select("id, created_at, file_name, scenario_name, storage_bucket, storage_key")
        .eq("user_id", uid)
        .eq("report_type", "INVESTMENT_REPORT")
        .order("created_at", { ascending: false });
      if (fbErr) throw toError(fbErr);
      return (fallback ?? []).map((r: any) => ({
        id: String(r.id),
        createdAt: String(r.created_at ?? ""),
        fileName: String(r.file_name ?? "investment-report.pdf"),
        label: r.scenario_name != null ? String(r.scenario_name) : null,
        propertyType: "investment",
        storageBucket: String(r.storage_bucket ?? "reports"),
        storageKey: String(r.storage_key ?? "")
      }));
    }
    throw toError(error);
  }

  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    createdAt: String(r.created_at ?? ""),
    fileName: String(r.file_name ?? "investment-report.pdf"),
    label: r.label != null ? String(r.label) : null,
    propertyType: String(r.property_type ?? ""),
    storageBucket: String(r.storage_bucket ?? "reports"),
    storageKey: String(r.storage_key ?? "")
  }));
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

  if (selErr) {
    if (isMissingTableError(selErr, "investment_reports")) {
      // Fallback delete via stored_reports
      const { data: fbRow, error: fbSelErr } = await sb
        .from("stored_reports")
        .select("id, storage_bucket, storage_key")
        .eq("id", reportId)
        .eq("user_id", uid)
        .eq("report_type", "INVESTMENT_REPORT")
        .maybeSingle();
      if (fbSelErr) throw toError(fbSelErr);
      if (!fbRow) throw new Error("Report not found.");
      const bucket = (fbRow as any).storage_bucket as string | null;
      const key = (fbRow as any).storage_key as string | null;
      if (bucket && key) await sb.storage.from(bucket).remove([key]);
      const { error: fbDelErr } = await sb
        .from("stored_reports")
        .delete()
        .eq("id", reportId)
        .eq("user_id", uid)
        .eq("report_type", "INVESTMENT_REPORT");
      if (fbDelErr) throw toError(fbDelErr);
      return;
    }
    throw toError(selErr);
  }
  if (!row) throw new Error("Report not found.");

  const bucket = (row as any).storage_bucket as string | null;
  const key = (row as any).storage_key as string | null;
  if (bucket && key) {
    await sb.storage.from(bucket).remove([key]);
  }

  const { error: delErr } = await sb.from("investment_reports").delete().eq("id", reportId).eq("user_id", uid);
  if (delErr) throw toError(delErr);
}

