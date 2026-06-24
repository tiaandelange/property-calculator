import type { SupabaseClient } from "@supabase/supabase-js";
import { renderPdfDefinitionToBuffer } from "./pdfMakeServer.js";
import {
  buildInvoicePdfDefinition,
  paymentDetailsLines,
  type InvoicePdfLineItem,
  type InvoicePdfPayment,
  type InvoicePdfBuildContext
} from "./invoicePdfBuilder.js";
import {
  invoicePaymentReferenceForInvoice,
  leaseReferenceFromEmbed
} from "./invoicePaymentDetailsShared.js";
import { loadFinancialLandlordContext } from "./financialLandlordContext.js";
import {
  invoiceHasStoredPdf,
  invoicePdfStorageKey,
  shouldPersistInvoicePdf
} from "./invoicePdfPolicy.js";
import { buildGlobalPdfTheme } from "./pdf/globalPdfTheme.js";
import { loadProplyticLogoDataUrl } from "./pdf/pdfLogoAsset.js";

const INVOICES_BUCKET = "invoices";

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

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
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

export type InvoicePdfGenerateResult = {
  pdfBuffer: Buffer;
  invoiceId: string;
  invoiceNumber: string;
  persistPdf: boolean;
  storageKey: string;
  fileName: string;
  reused: boolean;
  invoice: Record<string, unknown>;
};

async function loadPdfBuildContext(
  sb: SupabaseClient,
  uid: string,
  tenantPropertyAddress: string
): Promise<InvoicePdfBuildContext> {
  const [{ data: settings }, financial] = await Promise.all([
    sb
      .from("user_settings")
      .select("accent_color, pdf_branding_enabled")
      .eq("user_id", uid)
      .maybeSingle(),
    loadFinancialLandlordContext(sb, uid)
  ]);

  return {
    theme: buildGlobalPdfTheme({ accentColor: settings?.accent_color }),
    logoDataUrl: loadProplyticLogoDataUrl(),
    pdfBrandingEnabled: settings?.pdf_branding_enabled !== false,
    useBusinessForFinancials: financial.useBusinessForFinancials,
    landlord: {
      name: financial.landlord.name,
      email: financial.landlord.email,
      phone: financial.landlord.phone,
      address: financial.landlord.address
    },
    tenantPropertyAddress: tenantPropertyAddress || undefined,
    paymentDetailsRaw: financial.invoicePaymentDetails
  };
}

/** Build invoice PDF bytes — shared by the Vercel generate route. */
export async function buildInvoicePdfForUser(
  sb: SupabaseClient,
  uid: string,
  invoiceId: string,
  opts: { forceRegenerate?: boolean } = {}
): Promise<InvoicePdfGenerateResult> {
  const forceRegenerate = Boolean(opts.forceRegenerate);

  const { data: invoice, error: invErr } = await sb
    .from("invoices")
    .select(
      `
        id,
        user_id,
        property_id,
        tenant_id,
        lease_id,
        invoice_number,
        invoice_date,
        issue_date,
        due_date,
        status,
        subtotal,
        tax_amount,
        total,
        total_amount,
        balance_due,
        notes,
        pdf_storage_bucket,
        pdf_storage_key,
        invoice_line_items ( id, description, quantity, unit_price, total, category, sort_order ),
        invoice_payments ( id, payment_date, payment_reference, amount ),
        tenants ( first_name, last_name, email, phone, id_number ),
        properties (
          name,
          address_line1,
          address_line2,
          suburb,
          city,
          province,
          postal_code
        ),
        property_units ( unit_name ),
        leases ( id, start_date, fixed_term_end_date, status, lease_reference )
      `
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr) throw new Error(invErr.message);
  if (!invoice) throw new Error("Invoice not found.");
  if (String(invoice.user_id) !== uid) throw new Error("Invoice not found.");

  const status = String(invoice.status ?? "DRAFT");
  const persistPdf = shouldPersistInvoicePdf(status);
  const storageKey = invoicePdfStorageKey(uid, invoiceId);
  const invoiceNumber = String(invoice.invoice_number ?? invoiceId);
  const fileName = `${invoiceNumber.replace(/[^\w.-]+/g, "_") || "invoice"}.pdf`;

  if (persistPdf && !forceRegenerate && invoiceHasStoredPdf(invoice, INVOICES_BUCKET)) {
    return {
      pdfBuffer: Buffer.alloc(0),
      invoiceId,
      invoiceNumber,
      persistPdf,
      storageKey: String(invoice.pdf_storage_key),
      fileName,
      reused: true,
      invoice: invoice as Record<string, unknown>
    };
  }

  const invoiceDateIso = isoDate(invoice.issue_date ?? invoice.invoice_date);

  const tenant = firstEmbed<Record<string, unknown>>(invoice.tenants);
  const tenantLines = tenant
    ? [
        `${tenant.first_name ?? ""} ${tenant.last_name ?? ""}`.trim(),
        tenant.email ? String(tenant.email) : "",
        tenant.phone ? String(tenant.phone) : "",
        tenant.id_number ? `ID: ${tenant.id_number}` : ""
      ].filter(Boolean)
    : ["—"];

  const property = firstEmbed<Record<string, unknown>>(invoice.properties);
  const streetAddr = propertyStreetAddress(property);
  const propertyLines = property
    ? [property.name ? String(property.name).trim() : "", streetAddr].filter(Boolean)
    : ["—"];

  const lease = firstEmbed<Record<string, unknown>>(invoice.leases);

  const rawLines = invoice.invoice_line_items as Array<Record<string, unknown>> | null;
  const lineItems: InvoicePdfLineItem[] = (rawLines ?? [])
    .sort(
      (a, b) =>
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
        String(a.id ?? "").localeCompare(String(b.id ?? ""))
    )
    .map((li) => ({
      description: String(li.description ?? ""),
      quantity: Number(li.quantity) || 0,
      unitPrice: Number(li.unit_price) || 0,
      total: Number(li.total) || 0
    }));

  const rawPayments = invoice.invoice_payments as Array<Record<string, unknown>> | null;
  const payments: InvoicePdfPayment[] = (rawPayments ?? [])
    .sort(
      (a, b) =>
        String(a.payment_date ?? "").localeCompare(String(b.payment_date ?? "")) ||
        String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
    )
    .map((p) => ({
      date: isoDate(p.payment_date).slice(0, 10),
      reference: p.payment_reference != null ? String(p.payment_reference) : null,
      amount: Number(p.amount) || 0
    }));

  const total = Number(invoice.total_amount ?? invoice.total) || 0;
  const taxTotal = Number(invoice.tax_amount) || 0;
  const paymentsSum = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const balanceDue = Math.max(0, total - paymentsSum);
  const leaseRef = leaseReferenceFromEmbed(lease);
  const paymentReference = invoicePaymentReferenceForInvoice(leaseRef, invoiceNumber);

  const pdfContext = await loadPdfBuildContext(sb, uid, streetAddr);

  const definition = buildInvoicePdfDefinition(
    {
      invoiceId,
      invoiceNumber,
      invoiceDate: invoiceDateIso,
      dueDate: isoDate(invoice.due_date),
      status,
      subtotal: Number(invoice.subtotal) || total,
      taxTotal: taxTotal > 0 ? taxTotal : undefined,
      total,
      balanceDue,
      notes: invoice.notes != null ? String(invoice.notes) : null,
      tenantLines,
      propertyLines,
      unitLabel: null,
      leaseLabel: null,
      paymentReference,
      lineItems,
      payments,
      paymentDetailLines: paymentDetailsLines(pdfContext.paymentDetailsRaw, leaseRef),
      isDraftPreview: !persistPdf
    },
    pdfContext
  );

  const pdfBuffer = await renderPdfDefinitionToBuffer(definition);

  return {
    pdfBuffer,
    invoiceId,
    invoiceNumber,
    persistPdf,
    storageKey,
    fileName,
    reused: false,
    invoice: invoice as Record<string, unknown>
  };
}

export { INVOICES_BUCKET };
