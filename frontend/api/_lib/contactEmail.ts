/**
 * Server-only contact form notification email via Resend.
 * Do not import from `src/` or invoice email modules.
 */
import { Resend } from "resend";
import type { ContactServerConfigReady } from "./contactServerEnv.js";
import { messagePlainTextToHtml } from "./invoiceEmailValidation.js";

export type SendContactNotificationEmailInput = {
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  source: string;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export type SendContactNotificationEmailResult =
  | { ok: true; providerEmailId: string }
  | { ok: false; message: string };

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function buildContactEmailHtml(input: SendContactNotificationEmailInput): string {
  const lines = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone ?? "—"}`,
    `Subject: ${input.subject}`,
    "",
    "Message:",
    input.message,
    "",
    `Created: ${formatCreatedAt(input.createdAt)}`,
    `Source: ${input.source}`,
    `IP address: ${input.ipAddress ?? "—"}`,
    `User agent: ${input.userAgent ?? "—"}`
  ];

  return messagePlainTextToHtml(lines.join("\n"));
}

export async function sendContactNotificationEmail(
  input: SendContactNotificationEmailInput,
  mailConfig: ContactServerConfigReady
): Promise<SendContactNotificationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, message: "Email provider is not configured (RESEND_API_KEY missing)." };
  }

  const resend = new Resend(apiKey);
  const subject = `New Proplytic contact form submission: ${input.subject.trim()}`;

  try {
    const { data, error } = await resend.emails.send({
      from: mailConfig.fromEmail,
      to: [mailConfig.toEmail],
      replyTo: input.email.trim(),
      subject,
      html: buildContactEmailHtml(input)
    });

    if (error) {
      console.error("[contact-email] resend error", error);
      return { ok: false, message: error.message || "Failed to send email." };
    }

    const id = data?.id?.trim();
    if (!id) {
      return { ok: false, message: "Email provider did not return a message id." };
    }

    return { ok: true, providerEmailId: id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to send email.";
    console.error("[contact-email] send exception", msg);
    return { ok: false, message: msg };
  }
}
