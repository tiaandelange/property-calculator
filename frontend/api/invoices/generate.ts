import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { buildInvoicePdfForUser, INVOICES_BUCKET } from "../lib/invoicePdfGenerateServer.js";
import { invoiceHasStoredPdf, invoicePdfStorageKey } from "../lib/invoicePdfPolicy.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SEC = 600;

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

/** Invoice PDF generation — mirrors `api/reports/generate.ts` (static route + signed URL JSON). */
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
  const invoiceIdRaw = body.invoiceId ?? body.invoice_id;
  const invoiceId = typeof invoiceIdRaw === "string" ? invoiceIdRaw.trim() : String(invoiceIdRaw ?? "").trim();
  const forceRegenerate = body.force === true || body.force === 1 || String(body.force ?? "") === "1";

  if (!isUuid(invoiceId)) {
    res.status(400).json({ error: "invoiceId must be a UUID." });
    return;
  }

  try {
    const built = await buildInvoicePdfForUser(sb, uid, invoiceId, { forceRegenerate });

    if (built.reused) {
      const { data: signed, error: signErr } = await sb.storage
        .from(INVOICES_BUCKET)
        .createSignedUrl(built.storageKey, SIGNED_URL_TTL_SEC);
      if (!signErr && signed?.signedUrl) {
        res.status(200).json({
          message: "Invoice PDF ready",
          invoiceId,
          hasPdf: true,
          reused: true,
          downloadUrl: signed.signedUrl,
          expiresIn: SIGNED_URL_TTL_SEC,
          storageKey: built.storageKey,
          storageBucket: INVOICES_BUCKET
        });
        return;
      }
    }

    const storageKey = built.persistPdf ? invoicePdfStorageKey(uid, invoiceId) : `${uid}/invoices/preview/${invoiceId}.pdf`;

    if (!built.persistPdf && invoiceHasStoredPdf(built.invoice, INVOICES_BUCKET)) {
      const priorKey = String(built.invoice.pdf_storage_key);
      await sb.storage.from(INVOICES_BUCKET).remove([priorKey]);
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

    if (built.persistPdf) {
      const priorKey =
        built.invoice.pdf_storage_bucket === INVOICES_BUCKET && built.invoice.pdf_storage_key
          ? String(built.invoice.pdf_storage_key)
          : null;
      if (priorKey && priorKey !== storageKey) {
        await sb.storage.from(INVOICES_BUCKET).remove([priorKey]);
      }
    }

    const { error: upErr } = await sb.storage.from(INVOICES_BUCKET).upload(storageKey, built.pdfBuffer, {
      contentType: "application/pdf",
      upsert: true
    });
    if (upErr) {
      console.error("[invoices/generate] storage upload failed", upErr);
      res.status(500).json({ error: "Failed to upload PDF to storage." });
      return;
    }

    if (built.persistPdf) {
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
        console.error("[invoices/generate] invoice update failed", updErr);
        await sb.storage.from(INVOICES_BUCKET).remove([storageKey]);
        res.status(500).json({ error: "Failed to save invoice PDF metadata." });
        return;
      }
    }

    const { data: signed, error: signErr } = await sb.storage
      .from(INVOICES_BUCKET)
      .createSignedUrl(storageKey, SIGNED_URL_TTL_SEC);
    if (signErr || !signed?.signedUrl) {
      res.status(201).json({
        invoiceId,
        hasPdf: built.persistPdf,
        ephemeral: !built.persistPdf,
        storageKey,
        storageBucket: INVOICES_BUCKET,
        error: signErr?.message ?? "Signed URL could not be created."
      });
      return;
    }

    res.status(201).json({
      message: built.persistPdf ? "Invoice PDF generated" : "Draft invoice PDF generated",
      invoiceId,
      hasPdf: built.persistPdf,
      ephemeral: !built.persistPdf,
      downloadUrl: signed.signedUrl,
      expiresIn: SIGNED_URL_TTL_SEC,
      storageKey,
      storageBucket: INVOICES_BUCKET
    });
  } catch (e: unknown) {
    console.error("[invoices/generate]", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to generate invoice PDF." });
  }
}
