/** Server-only validation for public contact form POST bodies. */

import { isValidEmailAddress } from "./invoiceEmailValidation.js";

export const CONTACT_MESSAGE_MAX_LENGTH = 3000;

export type ContactFormPayload = {
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  source: string;
  website: string | null;
};

export function parseContactFormBody(body: unknown): ContactFormPayload {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const websiteRaw = raw.website;
  const website =
    websiteRaw === undefined || websiteRaw === null
      ? null
      : String(websiteRaw).trim() || null;

  return {
    name: String(raw.name ?? "").trim(),
    email: String(raw.email ?? "").trim(),
    phone: optionalTrimmedString(raw.phone),
    subject: String(raw.subject ?? "").trim(),
    message: String(raw.message ?? "").trim(),
    source: String(raw.source ?? "contact_page").trim() || "contact_page",
    website
  };
}

function optionalTrimmedString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s || null;
}

export function validateContactFormPayload(payload: ContactFormPayload): string | null {
  if (!payload.name) return "Name is required.";
  if (payload.name.length > 200) return "Name is too long.";

  if (!payload.email) return "Email is required.";
  if (!isValidEmailAddress(payload.email)) return "Email address is invalid.";

  if (payload.phone && payload.phone.length > 50) return "Phone number is too long.";

  if (!payload.subject) return "Subject is required.";
  if (payload.subject.length > 200) return "Subject is too long.";

  if (!payload.message) return "Message is required.";
  if (payload.message.length > CONTACT_MESSAGE_MAX_LENGTH) {
    return `Message must be ${CONTACT_MESSAGE_MAX_LENGTH} characters or fewer.`;
  }

  if (payload.source.length > 100) return "Source is invalid.";

  return null;
}

export function isContactHoneypotTriggered(website: string | null): boolean {
  return Boolean(website && website.length > 0);
}
