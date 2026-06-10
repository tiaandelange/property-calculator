import type { VercelRequest } from "@vercel/node";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function supabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  return { url: url.trim(), anonKey: anonKey.trim() };
}

export function bearerTokenFromRequest(req: VercelRequest): string {
  const authHeader = String(req.headers.authorization ?? "");
  return authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
}

export type AuthenticatedSupabase = {
  sb: SupabaseClient;
  user: User;
  uid: string;
  token: string;
};

export async function authenticateSupabaseRequest(
  req: VercelRequest
): Promise<{ ok: true; ctx: AuthenticatedSupabase } | { ok: false; status: number; error: string }> {
  const { url, anonKey } = supabasePublicEnv();
  if (!url || !anonKey) {
    return { ok: false, status: 500, error: "Server missing SUPABASE_URL / SUPABASE_ANON_KEY (or VITE_* equivalents)." };
  }

  const token = bearerTokenFromRequest(req);
  if (!token) {
    return { ok: false, status: 401, error: "Authorization: Bearer <access_token> is required." };
  }

  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: userData, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userData.user) {
    return { ok: false, status: 401, error: authErr?.message ?? "Invalid or expired session." };
  }

  return { ok: true, ctx: { sb, user: userData.user, uid: userData.user.id, token } };
}
