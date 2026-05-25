import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role client for cron / batch jobs only — never expose key to the browser. */
export function createServiceRoleSupabase(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function cronSecretFromRequest(authHeader: string | undefined): string {
  const h = String(authHeader ?? "");
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return h.trim();
}

export function verifyCronSecret(provided: string): boolean {
  const expected = (process.env.CRON_SECRET || "").trim();
  if (!expected) return false;
  return provided.length > 0 && provided === expected;
}
