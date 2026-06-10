/**
 * Server-only env checks for POST /api/contact.
 * Never import from `src/` — keeps secrets off the frontend bundle.
 */

/** Inbox for contact notifications (not a secret; override via CONTACT_TO_EMAIL). */
export const CONTACT_DELIVERY_EMAIL_DEFAULT = "delangetiaanoffice@gmail.com";

/** Safe message returned to browsers when server env is incomplete. */
export const CONTACT_PUBLIC_CONFIG_ERROR =
  "Contact form is temporarily unavailable. Please try again later or email us directly.";

export type ContactServerConfigReady = {
  fromEmail: string;
  toEmail: string;
};

export type ContactServerConfigResult =
  | { ok: true; config: ContactServerConfigReady }
  | { ok: false; status: 503; publicError: string; missing: string[] };

function supabaseUrlFromEnv(): string {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
}

function serviceRoleKeyFromEnv(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

/** Same fallback chain as invoice email (`invoiceEmail.ts`). */
const INVOICE_EMAIL_FROM_DEFAULT = "Proplytic Accounts <invoices@proplytic.co.za>";

export function contactFromEmailFromEnv(): string {
  return (
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    process.env.INVOICE_EMAIL_FROM?.trim() ||
    INVOICE_EMAIL_FROM_DEFAULT
  );
}

/** Lists missing server env vars (names only — never values). */
export function missingContactServerEnvVars(): string[] {
  const missing: string[] = [];

  if (!supabaseUrlFromEnv()) {
    missing.push("SUPABASE_URL");
  }
  if (!serviceRoleKeyFromEnv()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    missing.push("RESEND_API_KEY");
  }

  return missing;
}

export function getContactServerConfig(): ContactServerConfigResult {
  const missing = missingContactServerEnvVars();
  if (missing.length > 0) {
    console.error("[contact] missing server environment variables:", missing.join(", "));
    return {
      ok: false,
      status: 503,
      publicError: CONTACT_PUBLIC_CONFIG_ERROR,
      missing
    };
  }

  return {
    ok: true,
    config: {
      fromEmail: contactFromEmailFromEnv(),
      toEmail: process.env.CONTACT_TO_EMAIL?.trim() || CONTACT_DELIVERY_EMAIL_DEFAULT
    }
  };
}

export function isContactServerConfigured(): boolean {
  return getContactServerConfig().ok;
}
