import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertInvestmentReportQuota } from "../lib/investmentReportQuota.js";
import { renderPdfDefinitionToBuffer } from "../lib/pdfMakeServer.js";
import { buildCalculationReportPdfDefinition, buildInvestmentReportPdfDefinition, buildPropertySummaryPdfDefinition } from "../lib/reportPdfBuilders.js";
import { assemblePropertyInvestmentReportData } from "../lib/propertyInvestmentReportData.js";

const PROPERTY_REPORT_SELECT = `
  id, name, property_type, investment_type,
  address_line1, address_line2, suburb, city, province, postal_code,
  purchase_price, purchase_date, current_estimated_value, after_repair_value,
  transfer_costs, bond_costs, rehab_budget, total_cash_invested,
  outstanding_bond_balance, monthly_bond_payment,
  bond_annual_interest_rate_percent, bond_term_years, bond_start_date,
  bond_remaining_term_months, bond_interest_portion_override, bond_principal_portion_override,
  expected_monthly_income, expected_monthly_expenses,
  expected_annual_appreciation_percent, management_fee_percent,
  maintenance_monthly, rates_and_taxes_monthly, levies_monthly,
  bedrooms, bathrooms, size_sqm, parking_bays, notes, zoning, land_use,
  security_monthly, monthly_utilities, holding_period_years
`;

const INVOICE_REPORT_SELECT = `
  id, invoice_number, status, total, total_amount, balance_due, tenant_id, due_date, invoice_date,
  invoice_payments ( id, payment_date, payment_reference, amount )
`;

const LEASE_REPORT_SELECT = `
  id, status, start_date, fixed_term_end_date, monthly_rent, rent_due_day, unit_id,
  lease_tenants ( role, is_primary, tenants ( first_name, last_name ) ),
  property_units ( unit_name )
`;

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

function isMissingRelation(err: any, relation: string): boolean {
  const msg = String(err?.message ?? err?.details ?? "");
  const code = String(err?.code ?? "");
  return code === "42P01" || msg.includes(`relation "${relation}"`) || msg.includes(relation);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST, OPTIONS").json({ error: "Method not allowed" });
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

      const quotaErr = await assertInvestmentReportQuota(sb);
      if (quotaErr) {
        res.status(403).json({ error: quotaErr });
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

      const [propRes, profileRes, settingsRes, stmtRes, leaseRes, invRes] = await Promise.all([
        sb.from("properties").select(PROPERTY_REPORT_SELECT).eq("id", pid).maybeSingle(),
        sb.from("profiles").select("accent_color").eq("id", uid).maybeSingle(),
        sb.rpc("get_or_create_user_settings"),
        (() => {
          const now = new Date();
          return sb.rpc("get_property_monthly_statement", {
            p_property_id: pid,
            p_year: now.getUTCFullYear(),
            p_month: now.getUTCMonth() + 1,
            p_include_expected: true
          });
        })(),
        sb.from("leases").select(LEASE_REPORT_SELECT).eq("property_id", pid).eq("user_id", uid),
        sb.from("invoices").select(INVOICE_REPORT_SELECT).eq("property_id", pid).eq("user_id", uid)
      ]);

      const { data: prop, error: pErr } = propRes;
      if (pErr || !prop) {
        res.status(404).json({ error: "Property not found." });
        return;
      }

      if (stmtRes.error) {
        console.error("[reports/generate] get_property_monthly_statement", stmtRes.error);
        res.status(500).json({ error: stmtRes.error.message ?? "Failed to load statement." });
        return;
      }

      if (settingsRes.error) {
        console.warn("[reports/generate] get_or_create_user_settings failed; using projection defaults", settingsRes.error);
      }

      const stmt = (typeof stmtRes.data === "string" ? JSON.parse(stmtRes.data) : stmtRes.data) as Record<
        string,
        unknown
      >;
      const leases = (leaseRes.data ?? []) as Record<string, unknown>[];
      const invoices = (invRes.data ?? []) as Record<string, unknown>[];
      const userSettings = (settingsRes.data ?? null) as Record<string, unknown> | null;

      const reportModel = assemblePropertyInvestmentReportData({
        propertyRow: prop as Record<string, unknown>,
        statement: stmt,
        leases,
        invoices,
        projectionAssumptions: {
          annualIncomeGrowthPercentAnnual: (userSettings?.annual_income_growth_percent_annual as number | undefined) ?? null,
          expenseGrowthPercentAnnual: (userSettings?.expense_growth_percent_annual as number | undefined) ?? null,
          propertyAppreciationPercentAnnual: (userSettings?.property_appreciation_percent_annual as number | undefined) ?? null
        }
      });

      const accentColor =
        (profileRes.data?.accent_color as string | undefined) ??
        (profileRes.data as { accentColor?: string } | null)?.accentColor ??
        null;

      const definition = buildPropertySummaryPdfDefinition({
        reportModel,
        accentColor,
        scenarioName
      });

      const safeName = String(prop.name ?? "property")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 60);
      const pdfBuffer = await renderPdfDefinitionToBuffer(definition);
      const fileName = `property-investment-report-${safeName || pid}.pdf`;

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

    if (reportType === "INVESTMENT_REPORT") {
      const payload = (body.payload && typeof body.payload === "object") ? (body.payload as Record<string, unknown>) : null;
      if (!payload) {
        res.status(400).json({ error: "payload is required for INVESTMENT_REPORT." });
        return;
      }
      const propertyType = String(payload.propertyType ?? "").trim();
      const answers = (payload.answers && typeof payload.answers === "object") ? (payload.answers as Record<string, unknown>) : {};
      const metrics = (payload.metrics && typeof payload.metrics === "object") ? (payload.metrics as Record<string, unknown>) : {};
      if (!propertyType) {
        res.status(400).json({ error: "payload.propertyType is required." });
        return;
      }

      const quotaError = await assertInvestmentReportQuota(sb);
      if (quotaError) {
        res.status(402).json({ error: quotaError });
        return;
      }

      const settingsRes = await sb.rpc("get_or_create_user_settings");
      if (settingsRes.error) {
        console.warn("[reports/generate] get_or_create_user_settings failed; using projection defaults", settingsRes.error);
      }
      const us = (settingsRes.data ?? null) as Record<string, unknown> | null;

      const { definition } = buildInvestmentReportPdfDefinition({
        propertyType,
        answers,
        metrics,
        projectionAssumptions: {
          annualIncomeGrowthPercentAnnual: (us?.annual_income_growth_percent_annual as number | undefined) ?? null,
          expenseGrowthPercentAnnual: (us?.expense_growth_percent_annual as number | undefined) ?? null,
          propertyAppreciationPercentAnnual: (us?.property_appreciation_percent_annual as number | undefined) ?? null
        }
      });
      const pdfBuffer = await renderPdfDefinitionToBuffer(definition);
      const safeName = propertyType.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 50) || "investment";
      const fileName = `investment-report-${safeName}.pdf`;

      const { error: upErr } = await sb.storage.from(REPORTS_BUCKET).upload(storageKey, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false
      });
      if (upErr) {
        console.error("[reports/generate] storage upload failed", upErr);
        res.status(500).json({ error: "Failed to upload PDF to storage." });
        return;
      }

      const { error: insErr } = await sb.from("investment_reports").insert({
        id: reportId,
        user_id: uid,
        property_type: propertyType,
        label: scenarioName,
        file_name: fileName,
        storage_bucket: REPORTS_BUCKET,
        storage_key: storageKey,
        payload
      });
      if (insErr) {
        console.error("[reports/generate] investment_reports insert failed", insErr);
        // If the new table migration hasn't been applied yet, fall back to stored_reports
        // and still return the PDF URL (match property report robustness).
        if (!isMissingRelation(insErr, "investment_reports")) {
          await sb.storage.from(REPORTS_BUCKET).remove([storageKey]);
          res.status(500).json({ error: "Failed to save report metadata." });
          return;
        }
        const { error: fbErr } = await sb.from("stored_reports").insert({
          id: reportId,
          user_id: uid,
          report_type: "INVESTMENT_REPORT",
          file_name: fileName,
          calculation_id: null,
          property_id: null,
          invoice_id: null,
          scenario_name: scenarioName,
          storage_bucket: REPORTS_BUCKET,
          storage_key: storageKey,
          metadata: { source: "vercel", path: "api/reports/generate", fallback: "stored_reports" }
        });
        if (fbErr) {
          console.error("[reports/generate] stored_reports fallback insert failed", fbErr);
          // Don't block the PDF; metadata can be fixed after migrations.
        }
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
