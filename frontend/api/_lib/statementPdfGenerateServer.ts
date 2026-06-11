import type { SupabaseClient } from "@supabase/supabase-js";
import { renderPdfDefinitionToBuffer } from "./pdfMakeServer.js";
import { buildGlobalPdfTheme } from "./pdf/globalPdfTheme.js";
import { loadProplyticLogoDataUrl } from "./pdf/pdfLogoAsset.js";
import { buildStatementPdfDocumentDefinition, type StatementPdfLineItem } from "./pdf/statementPdfTemplate.js";
import { loadFinancialLandlordContext } from "./financialLandlordContext.js";
import {
  shouldPersistStatementPdf,
  statementHasStoredPdf,
  statementPdfStorageKey
} from "./statementPdfPolicy.js";

const STATEMENTS_BUCKET = "invoices";

function isoDate(v: unknown): string {
  if (v == null) return new Date().toISOString();
  const s = String(v);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

function firstEmbed<T extends Record<string, unknown>>(raw: unknown): T | null {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === "object" ? (first as T) : null;
  }
  return raw as T;
}

function propertyStreetAddress(property: Record<string, unknown> | null): string {
  if (!property) return "";
  return [
    property.address_line1,
    property.address_line2,
    property.suburb,
    property.city,
    property.province,
    property.postal_code
  ]
    .filter(Boolean)
    .map(String)
    .join(", ");
}

export type StatementPdfGenerateResult = {
  pdfBuffer: Buffer;
  statementId: string;
  statementNumber: string;
  persistPdf: boolean;
  storageKey: string;
  fileName: string;
  reused: boolean;
  statement: Record<string, unknown>;
};

export async function buildStatementPdfForUser(
  sb: SupabaseClient,
  uid: string,
  statementId: string,
  opts: { forceRegenerate?: boolean } = {}
): Promise<StatementPdfGenerateResult> {
  const forceRegenerate = Boolean(opts.forceRegenerate);

  const { data: statement, error: stmtErr } = await sb
    .from("tenant_statement_documents")
    .select(
      `
        id,
        user_id,
        property_id,
        tenant_id,
        statement_type,
        statement_number,
        statement_date,
        period_start,
        period_end,
        opening_balance,
        total,
        status,
        notes,
        pdf_storage_bucket,
        pdf_storage_key,
        tenant_statement_line_items ( id, description, quantity, unit_price, total, entry_type, transaction_date, sort_order ),
        tenants ( first_name, last_name, email, phone ),
        properties (
          name,
          address_line1,
          address_line2,
          suburb,
          city,
          province,
          postal_code
        )
      `
    )
    .eq("id", statementId)
    .maybeSingle();

  if (stmtErr) throw new Error(stmtErr.message);
  if (!statement) throw new Error("Statement not found.");
  if (String(statement.user_id) !== uid) throw new Error("Statement not found.");

  const status = String(statement.status ?? "DRAFT");
  const persistPdf = shouldPersistStatementPdf(status);
  const storageKey = statementPdfStorageKey(uid, statementId);
  const statementNumber = String(statement.statement_number ?? statementId);
  const fileName = `${statementNumber.replace(/[^\w.-]+/g, "_") || "statement"}.pdf`;

  if (persistPdf && !forceRegenerate && statementHasStoredPdf(statement, STATEMENTS_BUCKET)) {
    return {
      pdfBuffer: Buffer.alloc(0),
      statementId,
      statementNumber,
      persistPdf,
      storageKey: String(statement.pdf_storage_key),
      fileName,
      reused: true,
      statement: statement as Record<string, unknown>
    };
  }

  const [{ data: settings }, financial] = await Promise.all([
    sb
      .from("user_settings")
      .select("accent_color, pdf_branding_enabled")
      .eq("user_id", uid)
      .maybeSingle(),
    loadFinancialLandlordContext(sb, uid)
  ]);

  const theme = buildGlobalPdfTheme({ accentColor: settings?.accent_color });
  const tenant = firstEmbed<Record<string, unknown>>(statement.tenants);
  const tenantLines = tenant
    ? [
        `${tenant.first_name ?? ""} ${tenant.last_name ?? ""}`.trim(),
        tenant.email ? String(tenant.email) : "",
        tenant.phone ? String(tenant.phone) : ""
      ].filter(Boolean)
    : ["—"];

  const property = firstEmbed<Record<string, unknown>>(statement.properties);
  const streetAddr = propertyStreetAddress(property);
  const propertyLines = property
    ? [property.name ? String(property.name).trim() : "", streetAddr].filter(Boolean)
    : ["—"];

  const rawLines = statement.tenant_statement_line_items as Array<Record<string, unknown>> | null;
  const lineItems: StatementPdfLineItem[] = (rawLines ?? [])
    .sort(
      (a, b) =>
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
        String(a.id ?? "").localeCompare(String(b.id ?? ""))
    )
    .map((li) => ({
      date: li.transaction_date != null ? String(li.transaction_date).slice(0, 10) : null,
      description: String(li.description ?? ""),
      entryType: String(li.entry_type ?? "DEBIT").toUpperCase() === "CREDIT" ? "CREDIT" : "DEBIT",
      amount: Number(li.total) || 0
    }));

  const definition = buildStatementPdfDocumentDefinition({
    statementId,
    statementNumber,
    statementType: String(statement.statement_type ?? "FINANCIAL").toUpperCase() === "DEPOSIT" ? "DEPOSIT" : "FINANCIAL",
    statementDate: isoDate(statement.statement_date),
    periodStart: statement.period_start != null ? String(statement.period_start) : null,
    periodEnd: statement.period_end != null ? String(statement.period_end) : null,
    openingBalance: Number(statement.opening_balance) || 0,
    total: Number(statement.total) || 0,
    notes: statement.notes != null ? String(statement.notes) : null,
    tenantLines,
    propertyLines,
    landlordName: financial.landlord.name,
    lineItems,
    isDraftPreview: !persistPdf,
    theme,
    logoDataUrl: loadProplyticLogoDataUrl(),
    pdfBrandingEnabled: settings?.pdf_branding_enabled !== false
  });

  const pdfBuffer = await renderPdfDefinitionToBuffer(definition);

  return {
    pdfBuffer,
    statementId,
    statementNumber,
    persistPdf,
    storageKey,
    fileName,
    reused: false,
    statement: statement as Record<string, unknown>
  };
}

export { STATEMENTS_BUCKET };
