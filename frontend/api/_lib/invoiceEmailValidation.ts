/** Server-only email validation helpers for invoice send. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isValidEmailAddress(email: string): boolean {
  const s = email.trim();
  if (!s || s.length > 320) return false;
  return EMAIL_RE.test(s);
}

export function normalizeRecipientEmails(emails: unknown): string[] {
  const raw = Array.isArray(emails) ? emails : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const e = String(item ?? "").trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export function validateRecipientEmails(emails: string[]): string | null {
  if (!emails.length) return "At least one recipient email is required.";
  for (const e of emails) {
    if (!isValidEmailAddress(e)) return `Invalid email address: ${e}`;
  }
  return null;
}

export function messagePlainTextToHtml(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #111827;">${escaped.replace(/\n/g, "<br />")}</div>`;
}
