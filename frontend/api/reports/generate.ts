import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const REPORTS_BUCKET = "reports";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

function supabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  return { url: url.trim(), anonKey: anonKey.trim() };
}

function parseJsonBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body;
  if (b == null) return {};
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  // Lazy-load PDF dependencies so any module interop issues don't surface as
  // FUNCTION_INVOCATION_FAILED (which prevents JSON errors from being returned).
  let renderPdfDefinitionToBuffer: (definition: any) => Promise<Buffer>;
  let buildCalculationReportPdfDefinition: any;
  let buildPropertySummaryPdfDefinition: any;
  try {
    const pdf = await import("../lib/pdfMakeServer");
    renderPdfDefinitionToBuffer = pdf.renderPdfDefinitionToBuffer as any;
    const builders = await import("../lib/reportPdfBuilders");
    buildCalculationReportPdfDefinition = (builders as any).buildCalculationReportPdfDefinition;
    buildPropertySummaryPdfDefinition = (builders as any).buildPropertySummaryPdfDefinition;
  } catch (e: any) {
    console.error("[reports/generate] module load failed", e);
    res.status(500).json({ error: e?.message ?? "PDF dependencies failed to load." });
    return;
  }

  const { url, anonKey } = supabasePublicEnv();
  if (!url || !anonKey) {
    res.status(500).json({ error: "Server missing SUPABASE_URL / SUPABASE_ANON_KEY (or VITE_* equivalents)." });
    return;
  }

  const authHeader = String(req.headers.authorization ?? "");
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Authorization: Bearer <access_token> is required." });
    return;
  }

  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: userData, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userData.user) {
    res.status(401).json({ error: authErr?.message ?? "Invalid or expired session." });
    return;
  }

  const uid = userData.user.id;
  const body = parseJsonBody(req);
  const reportType = String(body.reportType ?? "").trim();
  const scenarioName = typeof body.scenarioName === "string" ? body.scenarioName : null;

  if (!reportType) {
    res.status(400).json({ error: "reportType is required." });
    return;
  }

  const reportId = randomUUID();
  const storageKey = `${uid}/reports/${reportId}.pdf`;

  try {
    if (reportType === "CALCULATION") {
      const calculationIdRaw = body.calculationId;
      const cid = typeof calculationIdRaw === "string" ? calculationIdRaw : String(calculationIdRaw ?? "");
      if (!isUuid(cid)) {
        res.status(400).json({ error: "calculationId must be a UUID for CALCULATION reports." });
        return;
      }

      const { data: calc, error: cErr } = await sb
        .from("calculator_results")
        .select("id,type,input_json,result_json")
        .eq("id", cid)
        .maybeSingle();

      if (cErr || !calc) {
        res.status(404).json({ error: "Calculation not found." });
        return;
      }

      const { data: profile } = await sb.from("profiles").select("full_name").eq("id", uid).maybeSingle();
      const preparedFor =
        (profile?.full_name as string | undefined)?.trim() ||
        userData.user.email ||
        (userData.user.user_metadata as Record<string, unknown> | undefined)?.full_name?.toString() ||
        "Member";

      const { definition, scenarioName: scenarioFromCalc } = buildCalculationReportPdfDefinition({
        calculationId: cid,
        calcType: String(calc.type ?? ""),
        inputJson: calc.input_json,
        resultJson: calc.result_json,
        preparedForLabel: preparedFor,
        scenarioNameOverride: scenarioName
      });

      const pdfBuffer = await renderPdfDefinitionToBuffer(definition);
      const fileName = `calculation-${cid}.pdf`;

      const { error: upErr } = await sb.storage.from(REPORTS_BUCKET).upload(storageKey, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false
      });
      if (upErr) {
        console.error("[reports/generate] storage upload failed", upErr);
        res.status(500).json({ error: "Failed to upload PDF to storage." });
        return;
      }

      const { error: insErr } = await sb.from("stored_reports").insert({
        id: reportId,
        user_id: uid,
        report_type: reportType,
        file_name: fileName,
        calculation_id: cid,
        property_id: null,
        invoice_id: null,
        scenario_name: scenarioName ?? scenarioFromCalc,
        storage_bucket: REPORTS_BUCKET,
        storage_key: storageKey,
        metadata: { source: "vercel", path: "api/reports/generate" }
      });
      if (insErr) {
        console.error("[reports/generate] stored_reports insert failed", insErr);
        await sb.storage.from(REPORTS_BUCKET).remove([storageKey]);
        res.status(500).json({ error: "Failed to save report metadata." });
        return;
      }

      const { data: signed, error: signErr } = await sb.storage.from(REPORTS_BUCKET).createSignedUrl(storageKey, 600);
      if (signErr || !signed?.signedUrl) {
        res.status(201).json({
          reportId,
          storageKey,
          storageBucket: REPORTS_BUCKET,
          error: signErr?.message ?? "Signed URL could not be created."
        });
        return;
      }

      res.status(201).json({
        reportId,
        downloadUrl: signed.signedUrl,
        expiresIn: 600,
        storageKey,
        storageBucket: REPORTS_BUCKET
      });
      return;
    }

    if (reportType === "PROPERTY_SUMMARY") {
      const propertyIdRaw = body.propertyId;
      const pid = typeof propertyIdRaw === "string" ? propertyIdRaw : String(propertyIdRaw ?? "");
      if (!isUuid(pid)) {
        res.status(400).json({ error: "propertyId must be a UUID for PROPERTY_SUMMARY reports." });
        return;
      }

      const { data: prop, error: pErr } = await sb
        .from("properties")
        .select("id,name,address_line1,city,province,postal_code")
        .eq("id", pid)
        .maybeSingle();

      if (pErr || !prop) {
        res.status(404).json({ error: "Property not found." });
        return;
      }

      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;

      const { data: stmtRaw, error: rpcErr } = await sb.rpc("get_property_monthly_statement", {
        p_property_id: pid,
        p_year: year,
        p_month: month,
        p_include_expected: true
      });

      if (rpcErr) {
        console.error("[reports/generate] get_property_monthly_statement", rpcErr);
        res.status(500).json({ error: rpcErr.message ?? "Failed to load statement." });
        return;
      }

      const stmt = (typeof stmtRaw === "string" ? JSON.parse(stmtRaw) : stmtRaw) as Record<string, unknown>;
      const summary = (stmt.summary as Record<string, unknown>) ?? {};
      const rows = (stmt.statementRows as unknown[]) ?? [];

      const definition = buildPropertySummaryPdfDefinition({
        property: {
          name: String(prop.name ?? ""),
          addressLine1: String(prop.address_line1 ?? ""),
          city: String(prop.city ?? ""),
          province: String(prop.province ?? ""),
          postalCode: String(prop.postal_code ?? "")
        },
        summary,
        statementRows: rows,
        scenarioName
      });

      const pdfBuffer = await renderPdfDefinitionToBuffer(definition);
      const fileName = `property-${pid}.pdf`;

      const { error: upErr } = await sb.storage.from(REPORTS_BUCKET).upload(storageKey, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false
      });
      if (upErr) {
        console.error("[reports/generate] storage upload failed", upErr);
        res.status(500).json({ error: "Failed to upload PDF to storage." });
        return;
      }

      const { error: insErr } = await sb.from("stored_reports").insert({
        id: reportId,
        user_id: uid,
        report_type: reportType,
        file_name: fileName,
        calculation_id: null,
        property_id: pid,
        invoice_id: null,
        scenario_name: scenarioName,
        storage_bucket: REPORTS_BUCKET,
        storage_key: storageKey,
        metadata: { source: "vercel", path: "api/reports/generate" }
      });
      if (insErr) {
        console.error("[reports/generate] stored_reports insert failed", insErr);
        await sb.storage.from(REPORTS_BUCKET).remove([storageKey]);
        res.status(500).json({ error: "Failed to save report metadata." });
        return;
      }

      const { data: signed, error: signErr } = await sb.storage.from(REPORTS_BUCKET).createSignedUrl(storageKey, 600);
      if (signErr || !signed?.signedUrl) {
        res.status(201).json({
          reportId,
          storageKey,
          storageBucket: REPORTS_BUCKET,
          error: signErr?.message ?? "Signed URL could not be created."
        });
        return;
      }

      res.status(201).json({
        reportId,
        downloadUrl: signed.signedUrl,
        expiresIn: 600,
        storageKey,
        storageBucket: REPORTS_BUCKET
      });
      return;
    }

    res.status(400).json({ error: `Unsupported reportType: ${reportType}` });
  } catch (e: unknown) {
    console.error("[reports/generate]", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to generate report." });
  }
}
