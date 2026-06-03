import type { SupabaseClient } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";
import { sendContactNotificationEmail } from "./contactEmail.js";
import type { ContactServerConfigReady } from "./contactServerEnv.js";
import { CONTACT_PUBLIC_CONFIG_ERROR } from "./contactServerEnv.js";
import {
  isContactHoneypotTriggered,
  parseContactFormBody,
  validateContactFormPayload,
  type ContactFormPayload
} from "./contactFormValidation.js";
import { createServiceRoleSupabase } from "./supabaseServiceRole.js";

export type ContactSubmissionRow = {
  id: string;
  created_at: string;
};

export function clientIpFromRequest(req: VercelRequest): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() || null;
  }
  if (Array.isArray(forwarded)) {
    const first = forwarded[0];
    return typeof first === "string" ? first.split(",")[0]?.trim() || null : null;
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") return realIp.trim() || null;
  return null;
}

export function clientUserAgentFromRequest(req: VercelRequest): string | null {
  const ua = req.headers["user-agent"];
  if (typeof ua !== "string") return null;
  const trimmed = ua.trim();
  return trimmed || null;
}

export function parseAndValidateContactRequest(body: unknown):
  | { ok: true; payload: ContactFormPayload; honeypot: boolean }
  | { ok: false; error: string } {
  const payload = parseContactFormBody(body);

  if (isContactHoneypotTriggered(payload.website)) {
    return { ok: true, payload, honeypot: true };
  }

  const validationError = validateContactFormPayload(payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  return { ok: true, payload, honeypot: false };
}

export async function insertContactSubmission(
  sb: SupabaseClient,
  input: {
    payload: ContactFormPayload;
    ipAddress: string | null;
    userAgent: string | null;
  }
): Promise<{ ok: true; row: ContactSubmissionRow } | { ok: false; message: string }> {
  const { data, error } = await sb
    .from("contact_submissions")
    .insert({
      name: input.payload.name,
      email: input.payload.email,
      phone: input.payload.phone,
      subject: input.payload.subject,
      message: input.payload.message,
      source: input.payload.source,
      ip_address: input.ipAddress,
      user_agent: input.userAgent
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("[contact] supabase insert error", error);
    return { ok: false, message: error.message || "Failed to save contact submission." };
  }

  if (!data?.id) {
    return { ok: false, message: "Failed to save contact submission." };
  }

  return {
    ok: true,
    row: {
      id: String(data.id),
      created_at: String(data.created_at ?? new Date().toISOString())
    }
  };
}

export async function processContactFormSubmission(
  req: VercelRequest,
  serverConfig: ContactServerConfigReady
): Promise<
  | { status: 200; body: { ok: true; id?: string } }
  | { status: 400; body: { error: string } }
  | { status: 500; body: { error: string } }
  | { status: 502; body: { error: string; id: string } }
> {
  const parsed = parseAndValidateContactRequest(req.body);

  if (!parsed.ok) {
    return { status: 400, body: { error: parsed.error } };
  }

  if (parsed.honeypot) {
    return { status: 200, body: { ok: true } };
  }

  const sb = createServiceRoleSupabase();
  if (!sb) {
    console.error("[contact] service role client unavailable after env check");
    return {
      status: 503,
      body: { error: CONTACT_PUBLIC_CONFIG_ERROR }
    };
  }

  const ipAddress = clientIpFromRequest(req);
  const userAgent = clientUserAgentFromRequest(req);

  const inserted = await insertContactSubmission(sb, {
    payload: parsed.payload,
    ipAddress,
    userAgent
  });

  if (!inserted.ok) {
    return { status: 500, body: { error: inserted.message } };
  }

  const emailResult = await sendContactNotificationEmail(
    {
      name: parsed.payload.name,
      email: parsed.payload.email,
      phone: parsed.payload.phone,
      subject: parsed.payload.subject,
      message: parsed.payload.message,
      source: parsed.payload.source,
      createdAt: inserted.row.created_at,
      ipAddress,
      userAgent
    },
    serverConfig
  );

  if (!emailResult.ok) {
    return {
      status: 502,
      body: {
        error:
          "Your message was received but we could not send the notification email. Our team may still follow up shortly.",
        id: inserted.row.id
      }
    };
  }

  return { status: 200, body: { ok: true, id: inserted.row.id } };
}
