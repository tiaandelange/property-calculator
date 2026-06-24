import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { ensureInvoicePdfBuffer } from "./ensureInvoicePdfBuffer.js";
import { sendInvoiceEmailWithPdf } from "./invoiceEmail.js";
import {
  messagePlainTextToHtml,
  normalizeRecipientEmails,
  resolveCcEmailForSend,
  validateRecipientEmails
} from "./invoiceEmailValidation.js";

export type InvoiceSendEmailBody = {
  to: string[];
  subject: string;
  message: string;
  copyMe?: boolean;
};

const DRAFT_LIKE = new Set(["DRAFT", "GENERATED"]);

async function insertEmailLog(
  sb: SupabaseClient,
  row: {
    invoiceId: string;
    userId: string;
    recipientEmails: string[];
    ccEmails: string[] | null;
    subject: string;
    message: string;
    status: string;
    errorMessage?: string | null;
    providerEmailId?: string | null;
    sentAt?: string | null;
  }
): Promise<void> {
  const { error } = await sb.from("invoice_email_logs").insert({
    invoice_id: row.invoiceId,
    user_id: row.userId,
    recipient_emails: row.recipientEmails,
    cc_emails: row.ccEmails?.length ? row.ccEmails : null,
    subject: row.subject,
    message: row.message,
    provider: "resend",
    provider_email_id: row.providerEmailId ?? null,
    status: row.status,
    error_message: row.errorMessage ?? null,
    sent_at: row.sentAt ?? null
  });
  if (error) {
    console.error("[invoice-send-email] failed to insert email log", error.message);
  }
}

export async function processInvoiceSendEmail(
  sb: SupabaseClient,
  user: User,
  uid: string,
  invoiceId: string,
  body: InvoiceSendEmailBody
): Promise<{ ok: true; message: string; providerEmailId: string } | { ok: false; status: number; error: string }> {
  const to = normalizeRecipientEmails(body.to);
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();

  const recipientErr = validateRecipientEmails(to);
  if (recipientErr) return { ok: false, status: 400, error: recipientErr };
  if (!subject) return { ok: false, status: 400, error: "Subject is required." };
  if (!message) return { ok: false, status: 400, error: "Message is required." };

  const { data: invoice, error: invErr } = await sb
    .from("invoices")
    .select(
      `
        id,
        user_id,
        invoice_number,
        status,
        total,
        total_amount,
        balance_due,
        due_date,
        sent_at,
        tenants ( first_name, last_name, email ),
        properties ( name )
      `
    )
    .eq("id", invoiceId)
    .eq("user_id", uid)
    .maybeSingle();

  if (invErr || !invoice) {
    return { ok: false, status: 404, error: "Invoice not found." };
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("full_name, email, invoice_payment_details")
    .eq("id", uid)
    .maybeSingle();

  const cc: string[] = [];
  if (body.copyMe) {
    const ccEmail = resolveCcEmailForSend(
      profile?.invoice_payment_details,
      user.email,
      profile?.email
    );
    if (!ccEmail) {
      return {
        ok: false,
        status: 400,
        error: "Could not resolve your account email for CC. Sign in with an email address or set one under Account settings."
      };
    }
    const ccNorm = ccEmail;
    if (!to.includes(ccNorm)) {
      cc.push(ccNorm);
    }
  }

  let pdfAttachment: Awaited<ReturnType<typeof ensureInvoicePdfBuffer>>;
  try {
    pdfAttachment = await ensureInvoicePdfBuffer(sb, uid, invoiceId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to generate invoice PDF.";
    await insertEmailLog(sb, {
      invoiceId,
      userId: uid,
      recipientEmails: to,
      ccEmails: cc,
      subject,
      message,
      status: "failed",
      errorMessage: msg
    });
    return { ok: false, status: 500, error: msg };
  }

  const html = `${messagePlainTextToHtml(message)}<p style="margin-top:24px;font-size:12px;color:#6b7280;">Sent via Proplytic</p>`;

  const sent = await sendInvoiceEmailWithPdf({
    to,
    cc,
    subject,
    html,
    filename: pdfAttachment.fileName,
    pdfBuffer: pdfAttachment.pdfBuffer
  });

  if (!sent.ok) {
    await insertEmailLog(sb, {
      invoiceId,
      userId: uid,
      recipientEmails: to,
      ccEmails: cc,
      subject,
      message,
      status: "failed",
      errorMessage: sent.message
    });
    return { ok: false, status: 502, error: sent.message };
  }

  const now = new Date().toISOString();
  const currentStatus = String(invoice.status ?? "DRAFT").toUpperCase();
  const updateRow: Record<string, unknown> = {
    last_sent_at: now,
    sent_at: invoice.sent_at ?? now,
    recipient_email: to[0],
    email_provider: "resend",
    email_provider_id: sent.providerEmailId,
    email_status: "sent",
    updated_at: now
  };

  if (currentStatus === "PAID" || currentStatus === "CANCELLED" || currentStatus === "VOID") {
    /* keep status */
  } else if (DRAFT_LIKE.has(currentStatus)) {
    updateRow.status = "SENT";
  }

  const { error: updErr } = await sb.from("invoices").update(updateRow).eq("id", invoiceId).eq("user_id", uid);

  if (updErr) {
    console.error("[invoice-send-email] invoice update failed after send", updErr.message);
    return {
      ok: false,
      status: 500,
      error: "Email was sent but the invoice record could not be updated. Contact support if this persists."
    };
  }

  await insertEmailLog(sb, {
    invoiceId,
    userId: uid,
    recipientEmails: to,
    ccEmails: cc,
    subject,
    message,
    status: "sent",
    providerEmailId: sent.providerEmailId,
    sentAt: now
  });

  return { ok: true, message: "Invoice emailed successfully.", providerEmailId: sent.providerEmailId };
}
