/**
 * Server-only invoice email via Resend. Never import from `src/`.
 */
import { Resend } from "resend";

export const INVOICE_EMAIL_FROM =
  process.env.INVOICE_EMAIL_FROM?.trim() || "Proplytic Accounts <invoices@proplytic.co.za>";

export type SendInvoiceEmailWithPdfInput = {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  filename: string;
  pdfBuffer: Buffer;
};

export type SendInvoiceEmailResult =
  | { ok: true; providerEmailId: string }
  | { ok: false; message: string };

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendInvoiceEmailWithPdf(
  input: SendInvoiceEmailWithPdfInput
): Promise<SendInvoiceEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, message: "Email provider is not configured (RESEND_API_KEY missing)." };
  }

  const resend = new Resend(apiKey);
  const cc = (input.cc ?? []).filter(Boolean);

  try {
    const { data, error } = await resend.emails.send({
      from: INVOICE_EMAIL_FROM,
      to: input.to,
      cc: cc.length ? cc : undefined,
      subject: input.subject.trim(),
      html: input.html,
      attachments: [
        {
          filename: input.filename,
          content: input.pdfBuffer
        }
      ]
    });

    if (error) {
      console.error("[invoice-email] resend error", error);
      return { ok: false, message: error.message || "Failed to send email." };
    }

    const id = data?.id?.trim();
    if (!id) {
      return { ok: false, message: "Email provider did not return a message id." };
    }

    return { ok: true, providerEmailId: id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to send email.";
    console.error("[invoice-email] send exception", msg);
    return { ok: false, message: msg };
  }
}

export function resendEmailDeliveryConfigured(): boolean {
  return resendConfigured();
}
