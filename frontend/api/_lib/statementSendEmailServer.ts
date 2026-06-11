import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { sendInvoiceEmailWithPdf } from "./invoiceEmail.js";
import {
  messagePlainTextToHtml,
  normalizeRecipientEmails,
  validateRecipientEmails
} from "./invoiceEmailValidation.js";
import { buildStatementPdfForUser, STATEMENTS_BUCKET } from "./statementPdfGenerateServer.js";

export type StatementSendEmailBody = {
  to: string[];
  subject: string;
  message: string;
  copyMe?: boolean;
};

const DRAFT_LIKE = new Set(["DRAFT", "GENERATED"]);

function profileCcEmail(details: unknown, userEmail: string): string {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const cc = (details as Record<string, unknown>).ccEmail ?? (details as Record<string, unknown>).cc_email;
    if (cc != null && String(cc).trim()) return String(cc).trim();
  }
  return userEmail.trim();
}

export async function processStatementSendEmail(
  sb: SupabaseClient,
  user: User,
  uid: string,
  statementId: string,
  body: StatementSendEmailBody
): Promise<{ ok: true; message: string; providerEmailId: string } | { ok: false; status: number; error: string }> {
  const to = normalizeRecipientEmails(body.to);
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();

  const recipientErr = validateRecipientEmails(to);
  if (recipientErr) return { ok: false, status: 400, error: recipientErr };
  if (!subject) return { ok: false, status: 400, error: "Subject is required." };
  if (!message) return { ok: false, status: 400, error: "Message is required." };

  const { data: statement, error: stmtErr } = await sb
    .from("tenant_statement_documents")
    .select("id, user_id, statement_number, status, tenants ( first_name, last_name, email )")
    .eq("id", statementId)
    .maybeSingle();

  if (stmtErr) return { ok: false, status: 500, error: stmtErr.message };
  if (!statement || String(statement.user_id) !== uid) {
    return { ok: false, status: 404, error: "Statement not found." };
  }

  const status = String(statement.status ?? "DRAFT").toUpperCase();
  if (status === "VOID" || status === "CANCELLED") {
    return { ok: false, status: 400, error: "This statement cannot be sent." };
  }

  const built = await buildStatementPdfForUser(sb, uid, statementId, { forceRegenerate: true });
  let pdfBuffer = built.pdfBuffer;
  if (built.reused || pdfBuffer.length === 0) {
    const regen = await buildStatementPdfForUser(sb, uid, statementId, { forceRegenerate: true });
    pdfBuffer = regen.pdfBuffer;
  }

  const storageKey = built.storageKey;
  if (pdfBuffer.length > 0) {
    await sb.storage.from(STATEMENTS_BUCKET).upload(storageKey, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true
    });
    await sb
      .from("tenant_statement_documents")
      .update({
        pdf_storage_bucket: STATEMENTS_BUCKET,
        pdf_storage_key: storageKey,
        updated_at: new Date().toISOString()
      })
      .eq("id", statementId)
      .eq("user_id", uid);
  }

  const { data: profile } = await sb.from("profiles").select("invoice_payment_details").eq("id", uid).maybeSingle();
  const cc = body.copyMe ? [profileCcEmail(profile?.invoice_payment_details, user.email ?? "")] : [];

  const statementNumber = String(statement.statement_number ?? statementId);
  const fileName = `${statementNumber.replace(/[^\w.-]+/g, "_")}.pdf`;

  const sendResult = await sendInvoiceEmailWithPdf({
    to,
    cc: cc.filter(Boolean),
    subject,
    html: messagePlainTextToHtml(message),
    pdfBuffer,
    filename: fileName
  });

  if (!sendResult.ok) {
    return { ok: false, status: 502, error: sendResult.message };
  }

  const now = new Date().toISOString();
  const nextStatus = DRAFT_LIKE.has(status) ? "SENT" : status;
  await sb
    .from("tenant_statement_documents")
    .update({
      status: nextStatus,
      sent_at: now,
      updated_at: now
    })
    .eq("id", statementId)
    .eq("user_id", uid);

  return {
    ok: true,
    message: "Statement sent by email.",
    providerEmailId: sendResult.providerEmailId
  };
}
