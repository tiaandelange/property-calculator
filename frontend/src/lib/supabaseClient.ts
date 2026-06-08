import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-only Supabase client using the **anon** public key.
 *
 * **RLS:** The anon key is safe to expose in the bundle **only because** Row Level Security
 * policies on your tables restrict reads/writes per authenticated user. Without correct
 * RLS, the anon key does not protect data.
 *
 * Where to get values (Supabase Dashboard):
 * - **Project URL** → Project Settings → API → *Project URL* → use as `VITE_SUPABASE_URL`
 * - **Anon public key** → same page → *Project API keys* → `anon` `public` → use as `VITE_SUPABASE_ANON_KEY`
 *
 * **Stripe** secret keys (`sk_`, `whsec_`) and **Supabase service_role** belong on the
 * backend or Vercel **server** functions only — never here and never in any `VITE_*` variable.
 *
 * Local setup: copy `frontend/.env.example` to `frontend/.env.local`, set the two
 * variables, then `npm run dev`. `.env.local` is gitignored.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

/** True when both URL and anon key are set (non-empty). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * **Single browser Supabase client** for the SPA (or `null` if env vars are missing).
 * Do not call `createClient` elsewhere in frontend app code — use {@link getSupabase}
 * and {@link readAuthSession} from `authSession.ts` for session reads.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

/**
 * Returns the configured client or throws with a clear message.
 * Use when the call site requires Supabase (e.g. after a feature flag or route guard).
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
        "in frontend/.env.local (see frontend/.env.example). Values: Supabase Dashboard → Project Settings → API."
    );
  }
  return supabase;
}

/** Throws when Supabase env vars are missing (portfolio APIs require Supabase). */
export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.local."
    );
  }
}
