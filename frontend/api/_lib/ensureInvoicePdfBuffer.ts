import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInvoicePdfForUser, INVOICES_BUCKET } from "./invoicePdfGenerateServer.js";
import { invoicePdfStorageKey } from "./invoicePdfPolicy.js";

export type InvoicePdfAttachment = {
  pdfBuffer: Buffer;
  invoiceNumber: string;
  fileName: string;
  storageKey: string;
};

/** Generate or download the invoice PDF bytes for email attachment (always fresh generate when possible). */
export async function ensureInvoicePdfBuffer(
  sb: SupabaseClient,
  uid: string,
  invoiceId: string
): Promise<InvoicePdfAttachment> {
  const built = await buildInvoicePdfForUser(sb, uid, invoiceId, { forceRegenerate: true });

  const invoiceNumber = built.invoiceNumber;
  const fileName = `Invoice-${invoiceNumber.replace(/[^\w.-]+/g, "_") || "invoice"}.pdf`;
  const storageKey = built.persistPdf ? invoicePdfStorageKey(uid, invoiceId) : built.storageKey;

  if (built.pdfBuffer.length > 0) {
    if (built.persistPdf && storageKey) {
      await sb.storage.from(INVOICES_BUCKET).upload(storageKey, built.pdfBuffer, {
        contentType: "application/pdf",
        upsert: true
      });
      await sb
        .from("invoices")
        .update({
          pdf_storage_bucket: INVOICES_BUCKET,
          pdf_storage_key: storageKey,
          pdf_path: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", invoiceId)
        .eq("user_id", uid);
    }
    return { pdfBuffer: built.pdfBuffer, invoiceNumber, fileName, storageKey };
  }

  if (!storageKey) {
    throw new Error("Invoice PDF could not be generated.");
  }

  const { data: blob, error: dlErr } = await sb.storage.from(INVOICES_BUCKET).download(storageKey);
  if (dlErr || !blob) {
    throw new Error(dlErr?.message || "Failed to download invoice PDF from storage.");
  }

  const pdfBuffer = Buffer.from(await blob.arrayBuffer());
  if (!pdfBuffer.length) {
    throw new Error("Invoice PDF file is empty.");
  }

  return { pdfBuffer, invoiceNumber, fileName, storageKey };
}
