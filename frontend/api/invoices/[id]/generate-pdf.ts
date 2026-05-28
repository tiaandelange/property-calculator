import type { VercelRequest, VercelResponse } from "@vercel/node";
import { renderPdfDefinitionToBuffer } from "../../lib/pdfMakeServer";
import {
  buildInvoicePdfDefinition,
  paymentDetailsLines,
  threeMonthBoundsFromInvoiceDate,
  type InvoicePdfLedgerRow,
  type InvoicePdfLineItem
} from "../../lib/invoicePdfBuilder";
import { authenticateSupabaseRequest, isUuid } from "../../lib/supabaseServerAuth";

const INVOICES_BUCKET = "invoices";

function formatMoney(n: number) {
  return `R ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isoDate(v: unknown): string {
  if (v == null) return new Date().toISOString();
  const s = String(v);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const invoiceId = String(req.query.id ?? "").trim();
  if (!isUuid(invoiceId)) {
    res.status(400).json({ error: "Invoice id must be a UUID." });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const { sb, uid } = auth.ctx;

  try {
    const { data: invoice, error: invErr } = await sb
      .from("invoices")
      .select(
        `
        id,
        user_id,
        property_id,
        tenant_id,
        invoice_number,
        invoice_date,
        due_date,
        status,
        subtotal,
        total,
        notes,
        pdf_storage_bucket,
        pdf_storage_key,
        invoice_line_items ( id, description, quantity, unit_price, total ),
        tenants ( first_name, last_name, email, phone, id_number ),
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
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      res.status(404).json({ error: "Invoice not found." });
      return;
    }

    if (String(invoice.user_id) !== uid) {
      res.status(404).json({ error: "Invoice not found." });
      return;
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("invoice_payment_details")
      .eq("id", uid)
      .maybeSingle();

    const invoiceDateIso = isoDate(invoice.invoice_date);
    const { windowStart, windowEnd } = threeMonthBoundsFromInvoiceDate(invoiceDateIso);

    const propertyId = String(invoice.property_id);
    const tenantId = String(invoice.tenant_id);

    const [historyInvoicesRes, historyIncomeRes, openInvoicesRes] = await Promise.all([
      sb
        .from("invoices")
        .select("id, invoice_number, invoice_date, status, total")
        .eq("property_id", propertyId)
        .eq("tenant_id", tenantId)
        .gte("invoice_date", windowStart.toISOString())
        .lt("invoice_date", windowEnd.toISOString())
        .neq("status", "CANCELLED")
        .order("invoice_date", { ascending: true })
        .order("id", { ascending: true }),
      sb
        .from("income_entries")
        .select("income_date, category, description, amount, status")
        .eq("property_id", propertyId)
        .eq("tenant_id", tenantId)
        .gte("income_date", windowStart.toISOString())
        .lt("income_date", windowEnd.toISOString())
        .neq("status", "ARCHIVED")
        .order("income_date", { ascending: true })
        .order("id", { ascending: true }),
      sb
        .from("invoices")
        .select("total, status")
        .eq("property_id", propertyId)
        .eq("tenant_id", tenantId)
        .in("status", ["DRAFT", "SENT", "OVERDUE"])
    ]);

    if (historyInvoicesRes.error) {
      res.status(500).json({ error: historyInvoicesRes.error.message });
      return;
    }
    if (historyIncomeRes.error) {
      res.status(500).json({ error: historyIncomeRes.error.message });
      return;
    }
    if (openInvoicesRes.error) {
      res.status(500).json({ error: openInvoicesRes.error.message });
      return;
    }

    const ledgerRows: InvoicePdfLedgerRow[] = [];

    for (const hi of historyInvoicesRes.data ?? []) {
      const paid = hi.status === "PAID";
      ledgerRows.push({
        date: isoDate(hi.invoice_date).slice(0, 10),
        desc: `Invoice ${hi.invoice_number} (${hi.status})`,
        charge: paid ? "—" : formatMoney(Number(hi.total ?? 0)),
        payment: paid ? formatMoney(Number(hi.total ?? 0)) : "—"
      });
    }

    for (const inc of historyIncomeRes.data ?? []) {
      if (inc.status !== "RECEIVED") continue;
      ledgerRows.push({
        date: isoDate(inc.income_date).slice(0, 10),
        desc: `Payment recorded · ${inc.category}: ${inc.description}`,
        charge: "—",
        payment: formatMoney(Number(inc.amount ?? 0))
      });
    }

    ledgerRows.sort((a, b) => a.date.localeCompare(b.date) || a.desc.localeCompare(b.desc));

    const totalDueOutstanding = (openInvoicesRes.data ?? []).reduce((a, i) => a + Number(i.total ?? 0), 0);

    const tenantRaw = invoice.tenants as unknown;
    const tenant = (Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw) as Record<string, unknown> | null;
    const tenantLines = tenant
      ? [
          `${tenant.first_name ?? ""} ${tenant.last_name ?? ""}`.trim(),
          tenant.email ? String(tenant.email) : "",
          tenant.phone ? String(tenant.phone) : "",
          tenant.id_number ? `ID: ${tenant.id_number}` : ""
        ].filter(Boolean)
      : ["—"];

    const propertyRaw = invoice.properties as unknown;
    const property = (Array.isArray(propertyRaw) ? propertyRaw[0] : propertyRaw) as Record<string, unknown> | null;
    const addr = property
      ? [
          property.address_line1,
          property.address_line2,
          property.suburb,
          property.city,
          property.province,
          property.postal_code
        ]
          .filter(Boolean)
          .map(String)
          .join(", ")
      : "";
    const propertyLines = property
      ? [property.name ? String(property.name).trim() : "", addr].filter(Boolean)
      : ["—"];

    const rawLines = invoice.invoice_line_items as Array<Record<string, unknown>> | null;
    const lineItems: InvoicePdfLineItem[] = (rawLines ?? []).map((li) => ({
      description: String(li.description ?? ""),
      quantity: Number(li.quantity) || 0,
      unitPrice: Number(li.unit_price) || 0,
      total: Number(li.total) || 0
    }));

    const storageKey = `${uid}/invoices/${invoiceId}.pdf`;

    const priorKey =
      invoice.pdf_storage_bucket === INVOICES_BUCKET && invoice.pdf_storage_key
        ? String(invoice.pdf_storage_key)
        : null;
    if (priorKey && priorKey !== storageKey) {
      await sb.storage.from(INVOICES_BUCKET).remove([priorKey]);
    }

    const definition = buildInvoicePdfDefinition({
      invoiceId,
      invoiceNumber: String(invoice.invoice_number),
      invoiceDate: invoiceDateIso,
      dueDate: isoDate(invoice.due_date),
      status: String(invoice.status),
      subtotal: Number(invoice.subtotal) || 0,
      total: Number(invoice.total) || 0,
      notes: invoice.notes != null ? String(invoice.notes) : null,
      tenantLines,
      propertyLines,
      lineItems,
      ledgerRows,
      totalDueOutstanding,
      paymentDetailLines: paymentDetailsLines(profile?.invoice_payment_details)
    });

    const pdfBuffer = await renderPdfDefinitionToBuffer(definition);

    const { error: upErr } = await sb.storage.from(INVOICES_BUCKET).upload(storageKey, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true
    });
    if (upErr) {
      console.error("[invoices/generate-pdf] storage upload failed", upErr);
      res.status(500).json({ error: "Failed to upload PDF to storage." });
      return;
    }

    const { error: updErr } = await sb
      .from("invoices")
      .update({
        pdf_storage_bucket: INVOICES_BUCKET,
        pdf_storage_key: storageKey,
        pdf_path: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", invoiceId)
      .eq("user_id", uid);
    if (updErr) {
      console.error("[invoices/generate-pdf] invoice update failed", updErr);
      await sb.storage.from(INVOICES_BUCKET).remove([storageKey]);
      res.status(500).json({ error: "Failed to save invoice PDF metadata." });
      return;
    }

    const { data: signed, error: signErr } = await sb.storage.from(INVOICES_BUCKET).createSignedUrl(storageKey, 600);
    if (signErr || !signed?.signedUrl) {
      res.status(201).json({
        invoiceId,
        hasPdf: true,
        storageKey,
        storageBucket: INVOICES_BUCKET,
        error: signErr?.message ?? "Signed URL could not be created."
      });
      return;
    }

    res.status(201).json({
      message: "Invoice PDF generated",
      invoiceId,
      hasPdf: true,
      downloadUrl: signed.signedUrl,
      expiresIn: 600,
      storageKey,
      storageBucket: INVOICES_BUCKET
    });
  } catch (e: unknown) {
    console.error("[invoices/generate-pdf]", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to generate invoice PDF." });
  }
}
