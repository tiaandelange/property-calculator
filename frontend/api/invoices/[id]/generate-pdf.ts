import type { VercelRequest, VercelResponse } from "@vercel/node";
import { renderPdfDefinitionToBuffer } from "../../lib/pdfMakeServer.js";
import {
  buildInvoicePdfDefinition,
  paymentDetailsLines,
  threeMonthBoundsFromInvoiceDate,
  type InvoicePdfLedgerRow,
  type InvoicePdfLineItem
} from "../../lib/invoicePdfBuilder.js";
import {
  invoiceHasStoredPdf,
  invoicePdfStorageKey,
  shouldPersistInvoicePdf
} from "../../lib/invoicePdfPolicy.js";
import { authenticateSupabaseRequest, isUuid } from "../../lib/supabaseServerAuth";

const INVOICES_BUCKET = "invoices";
const SIGNED_URL_TTL_SEC = 600;

function formatMoney(n: number) {
  return `R ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

function unitLabelFromRow(unit: Record<string, unknown> | null): string | null {
  if (!unit) return null;
  const name = String(unit.unit_name ?? unit.unitName ?? unit.unit_label ?? unit.unitLabel ?? "").trim();
  return name || null;
}

function leaseLabelFromRow(lease: Record<string, unknown> | null): string | null {
  if (!lease) return null;
  const start = lease.start_date ?? lease.startDate;
  if (start) return `From ${String(start).slice(0, 10)}`;
  return "Active lease";
}

function paymentReferenceFromProfile(raw: unknown, invoiceNumber: string): string | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const note = (raw as Record<string, unknown>).referenceNote;
    if (note != null && String(note).trim()) return String(note).trim();
  }
  return invoiceNumber.trim() || null;
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
  const forceRegenerate = String(req.query.force ?? "").trim() === "1";

  try {
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
        total,
        total_amount,
        balance_due,
        notes,
        pdf_storage_bucket,
        pdf_storage_key,
        invoice_line_items ( id, description, quantity, unit_price, total, category, sort_order ),
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
        leases ( id, start_date, fixed_term_end_date, status )
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

    const status = String(invoice.status ?? "DRAFT");
    const persistPdf = shouldPersistInvoicePdf(status);
    const storageKey = invoicePdfStorageKey(uid, invoiceId);

    if (persistPdf && !forceRegenerate && invoiceHasStoredPdf(invoice, INVOICES_BUCKET)) {
      const existingKey = String(invoice.pdf_storage_key);
      const { data: signed, error: signErr } = await sb.storage
        .from(INVOICES_BUCKET)
        .createSignedUrl(existingKey, SIGNED_URL_TTL_SEC);
      if (!signErr && signed?.signedUrl) {
        res.status(200).json({
          message: "Invoice PDF ready",
          invoiceId,
          hasPdf: true,
          reused: true,
          downloadUrl: signed.signedUrl,
          expiresIn: SIGNED_URL_TTL_SEC,
          storageKey: existingKey,
          storageBucket: INVOICES_BUCKET
        });
        return;
      }
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("invoice_payment_details")
      .eq("id", uid)
      .maybeSingle();

    const invoiceDateIso = isoDate(invoice.issue_date ?? invoice.invoice_date);
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
        .select("total, status, balance_due, total_amount")
        .eq("property_id", propertyId)
        .eq("tenant_id", tenantId)
        .in("status", ["DRAFT", "GENERATED", "SENT", "OVERDUE", "DUE", "PARTIALLY_PAID"])
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

    const totalDueOutstanding = (openInvoicesRes.data ?? []).reduce(
      (a, i) => a + Number(i.balance_due ?? i.total_amount ?? i.total ?? 0),
      0
    );

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

    const unit = firstEmbed<Record<string, unknown>>(invoice.property_units);
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

    const invoiceNumber = String(invoice.invoice_number);
    const total = Number(invoice.total_amount ?? invoice.total) || 0;
    const balanceDue = Number(invoice.balance_due ?? total) || 0;
    const paymentReference = paymentReferenceFromProfile(profile?.invoice_payment_details, invoiceNumber);

    const definition = buildInvoicePdfDefinition({
      invoiceId,
      invoiceNumber,
      invoiceDate: invoiceDateIso,
      dueDate: isoDate(invoice.due_date),
      status,
      subtotal: Number(invoice.subtotal) || total,
      total,
      balanceDue,
      notes: invoice.notes != null ? String(invoice.notes) : null,
      tenantLines,
      propertyLines,
      unitLabel: unitLabelFromRow(unit),
      leaseLabel: leaseLabelFromRow(lease),
      paymentReference,
      lineItems,
      ledgerRows,
      totalDueOutstanding,
      paymentDetailLines: paymentDetailsLines(profile?.invoice_payment_details),
      isDraftPreview: !persistPdf
    });

    const pdfBuffer = await renderPdfDefinitionToBuffer(definition);

    if (!persistPdf) {
      if (invoiceHasStoredPdf(invoice, INVOICES_BUCKET)) {
        await sb.storage.from(INVOICES_BUCKET).remove([String(invoice.pdf_storage_key)]);
        await sb
          .from("invoices")
          .update({
            pdf_storage_bucket: null,
            pdf_storage_key: null,
            pdf_path: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", invoiceId)
          .eq("user_id", uid);
      }
      res.status(200).json({
        message: "Draft invoice PDF generated (not stored)",
        invoiceId,
        hasPdf: false,
        ephemeral: true,
        pdfBase64: pdfBuffer.toString("base64")
      });
      return;
    }

    const priorKey =
      invoice.pdf_storage_bucket === INVOICES_BUCKET && invoice.pdf_storage_key
        ? String(invoice.pdf_storage_key)
        : null;
    if (priorKey && priorKey !== storageKey) {
      await sb.storage.from(INVOICES_BUCKET).remove([priorKey]);
    }

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

    const { data: signed, error: signErr } = await sb.storage
      .from(INVOICES_BUCKET)
      .createSignedUrl(storageKey, SIGNED_URL_TTL_SEC);
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
      expiresIn: SIGNED_URL_TTL_SEC,
      storageKey,
      storageBucket: INVOICES_BUCKET
    });
  } catch (e: unknown) {
    console.error("[invoices/generate-pdf]", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to generate invoice PDF." });
  }
}
