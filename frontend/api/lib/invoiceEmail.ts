/**
 * Server-only invoice email (SMTP secrets). Never import from `src/`.
 */

export type SendInvoiceEmailInput = {
  to: string;
  subject: string;
  text: string;
};

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

export async function sendInvoiceEmail(
  input: SendInvoiceEmailInput
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const configured = smtpConfigured();
  console.log("[invoice-email] send attempt", { to: input.to, configured });

  if (!configured) {
    return { ok: false, message: "Email provider not configured." };
  }

  // Provider integration placeholder — do not report success until mail is actually sent.
  return {
    ok: false,
    message: "Email sending coming later."
  };
}
