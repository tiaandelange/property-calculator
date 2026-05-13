import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * Supabase **admin** client: `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, …)`.
 *
 * - **Service role key** bypasses Row Level Security. It is a **server secret**:
 *   use only in trusted backend code (Express, Vercel **server** functions, CI).
 *   **Never** import this module from `frontend/`, never put `SUPABASE_SERVICE_ROLE_KEY`
 *   in `VITE_*` or `NEXT_PUBLIC_*` env vars, and never commit a real key.
 *
 * - The browser must use the **anon** key (`VITE_SUPABASE_ANON_KEY` in the SPA) with
 *   **RLS policies** enforcing tenant isolation. The anon key alone does not protect
 *   rows; incorrect RLS would expose data.
 *
 * - `SUPABASE_URL` is not a cryptographic secret but is configured here on the server
 *   for this client; the SPA duplicates it as `VITE_SUPABASE_URL`.
 *
 * `null` when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is unset (e.g. unit tests
 * or local dev that only uses Prisma + `DATABASE_URL`).
 */
export const supabaseClient: SupabaseClient | null =
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

/** Same as {@link supabaseClient}; throws if service role is not configured. */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see backend/README.md)."
    );
  }
  return supabaseClient;
}

/** Alias for {@link getSupabaseServiceClient} — explicit "admin / service role" naming. */
export const getSupabaseAdminClient = getSupabaseServiceClient;

export const isSupabaseServiceConfigured = Boolean(supabaseClient);
