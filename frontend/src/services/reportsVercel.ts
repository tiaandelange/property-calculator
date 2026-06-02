import { getSupabase } from "../lib/supabaseClient";
import { readVercelError } from "./vercelResponse";

export type VercelReportType = "CALCULATION" | "PROPERTY_SUMMARY" | "INVESTMENT_REPORT";

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
  payload?: Record<string, unknown>;
}): Promise<GenerateReportResponse> {
  const sb = getSupabase();
  let token: string | undefined;
  const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
  if (sessionErr) throw sessionErr;
  token = sessionData.session?.access_token;
  if (!token) {
    const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession();
    if (refreshErr) throw refreshErr;
    token = refreshed.session?.access_token;
  }
  if (!token) throw new Error("Not signed in.");

  const body: Record<string, unknown> = { reportType: opts.reportType };
  if (opts.calculationId) body.calculationId = opts.calculationId;
  if (opts.propertyId) body.propertyId = opts.propertyId;
  if (opts.scenarioName != null) body.scenarioName = opts.scenarioName;
  if (opts.payload != null) body.payload = opts.payload;

  const res = await fetch("/api/reports/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const msg = await readVercelError(res);
    throw new Error(`${msg} (HTTP ${res.status})`);
  }

  const json = (await res.json().catch(() => ({}))) as GenerateReportResponse & { error?: string };
  if (!json.downloadUrl && json.error) throw new Error(json.error);
  return json;
}
