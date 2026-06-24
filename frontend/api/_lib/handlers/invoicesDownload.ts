import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildInvoicePdfForUser, INVOICES_BUCKET } from "../invoicePdfGenerateServer.js";
import { authenticateSupabaseRequest, isUuid } from "../supabaseServerAuth.js";

const SIGNED_URL_TTL_SEC = 600;

/**
 * Legacy GET /api/invoices/:id/download — generates or reuses stored PDF and redirects.
 * Replaces removed per-route handler after API consolidation.
 */
export async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).setHeader("Allow", "GET, HEAD").json({ error: "Method not allowed" });
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

  try {
    const built = await buildInvoicePdfForUser(auth.ctx.sb, auth.ctx.uid, invoiceId, { forceRegenerate: false });

    if (built.reused) {
      const { data: signed, error: signErr } = await auth.ctx.sb.storage
        .from(INVOICES_BUCKET)
        .createSignedUrl(built.storageKey, SIGNED_URL_TTL_SEC);
      if (!signErr && signed?.signedUrl) {
        res.status(302).setHeader("Location", signed.signedUrl).end();
        return;
      }
    }

    const storageKey = built.persistPdf ? built.storageKey : `${auth.ctx.uid}/invoices/preview/${invoiceId}.pdf`;

    const { error: upErr } = await auth.ctx.sb.storage.from(INVOICES_BUCKET).upload(storageKey, built.pdfBuffer, {
      contentType: "application/pdf",
      upsert: true
    });
    if (upErr) {
      res.status(500).json({ error: "Failed to upload PDF to storage." });
      return;
    }

    if (built.persistPdf) {
      await auth.ctx.sb
        .from("invoices")
        .update({
          pdf_storage_bucket: INVOICES_BUCKET,
          pdf_storage_key: storageKey,
          pdf_path: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", invoiceId)
        .eq("user_id", auth.ctx.uid);
    }

    const { data: signed, error: signErr } = await auth.ctx.sb.storage
      .from(INVOICES_BUCKET)
      .createSignedUrl(storageKey, SIGNED_URL_TTL_SEC);
    if (signErr || !signed?.signedUrl) {
      res.status(500).json({ error: signErr?.message ?? "Signed URL could not be created." });
      return;
    }

    res.status(302).setHeader("Location", signed.signedUrl).end();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to download invoice PDF.";
    console.error("[invoices/download]", invoiceId, msg);
    res.status(500).json({ error: msg });
  }
}
