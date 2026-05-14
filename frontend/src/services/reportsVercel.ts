import { getSupabase } from "../lib/supabaseClient";

export type VercelReportType = "CALCULATION" | "PROPERTY_SUMMARY";

export type GenerateReportResponse = {
  reportId: string;
  downloadUrl?: string;
  expiresIn?: number;
  storageKey?: string;
  storageBucket?: string;
  error?: string;
};

/**
 * Calls the Vercel serverless route `POST /api/reports/generate` (same origin as the SPA).
 * Requires a Supabase session access token.
 */
export async function generateReportViaVercel(opts: {
  reportType: VercelReportType;
  calculationId?: string;
  propertyId?: string;
  scenarioName?: string | null;
}): Promise<GenerateReportResponse> {
  const sb = getSupabase();
  const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
  if (sessionErr) throw sessionErr;
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const body: Record<string, unknown> = { reportType: opts.reportType };
  if (opts.calculationId) body.calculationId = opts.calculationId;
  if (opts.propertyId) body.propertyId = opts.propertyId;
  if (opts.scenarioName != null) body.scenarioName = opts.scenarioName;

  const res = await fetch("/api/reports/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const json = (await res.json().catch(() => ({}))) as GenerateReportResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Report generation failed (${res.status}).`);
  }
  if (!json.downloadUrl && json.error) {
    throw new Error(json.error);
  }
  return json;
}
