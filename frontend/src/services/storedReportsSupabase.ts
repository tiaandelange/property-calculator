import { getSupabase } from "../lib/supabaseClient";
import { requireUserId } from "./profileSupabase";

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object" && "message" in e) return new Error(String((e as any).message));
  return new Error(String(e));
}

export type PropertyStoredReportRow = {
  id: string;
  createdAt: string;
  fileName: string;
  propertyId: string | null;
  propertyName: string;
  storageBucket: string | null;
  storageKey: string | null;
};

export async function listPropertyStoredReports(): Promise<PropertyStoredReportRow[]> {
  const uid = await requireUserId();
  const sb = getSupabase();

  const { data, error } = await sb
    .from("stored_reports")
    .select(
      `
      id,
      created_at,
      file_name,
      property_id,
      storage_bucket,
      storage_key,
      properties ( name )
    `
    )
    .eq("user_id", uid)
    .eq("report_type", "PROPERTY_SUMMARY")
    .order("created_at", { ascending: false });

  if (error) throw toError(error);

  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    createdAt: String(r.created_at ?? ""),
    fileName: String(r.file_name ?? "report.pdf"),
    propertyId: r.property_id != null ? String(r.property_id) : null,
    propertyName: String((Array.isArray(r.properties) ? r.properties[0]?.name : r.properties?.name) ?? "Property"),
    storageBucket: r.storage_bucket != null ? String(r.storage_bucket) : null,
    storageKey: r.storage_key != null ? String(r.storage_key) : null
  }));
}

export async function getStoredReportSignedUrl(report: { storageBucket: string | null; storageKey: string | null }): Promise<string | null> {
  const sb = getSupabase();
  if (!report.storageBucket || !report.storageKey) return null;
  const { data, error } = await sb.storage.from(report.storageBucket).createSignedUrl(report.storageKey, 600);
  if (error) throw toError(error);
  return data?.signedUrl ?? null;
}

export async function deleteStoredReport(reportId: string): Promise<void> {
  const uid = await requireUserId();
  const sb = getSupabase();

  const { data: row, error: selErr } = await sb
    .from("stored_reports")
    .select("id, storage_bucket, storage_key")
    .eq("id", reportId)
    .eq("user_id", uid)
    .maybeSingle();

  if (selErr) throw toError(selErr);
  if (!row) throw new Error("Report not found.");

  const bucket = (row as any).storage_bucket as string | null;
  const key = (row as any).storage_key as string | null;
  if (bucket && key) {
    await sb.storage.from(bucket).remove([key]);
  }

  const { error: delErr } = await sb.from("stored_reports").delete().eq("id", reportId).eq("user_id", uid);
  if (delErr) throw toError(delErr);
}

