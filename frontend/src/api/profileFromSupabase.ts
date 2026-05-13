import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";

/** Columns read from `public.profiles` for the SPA shell and `fetchMe`. */
export const PROFILE_SELECT_FOR_APP =
  "full_name, role, invoice_payment_details, ui_color_scheme, free_uses_remaining" as const;

export type ProfileForApp = {
  full_name: string | null;
  role: string | null;
  invoice_payment_details: unknown;
  ui_color_scheme: string | null;
  free_uses_remaining: number | null;
};

/**
 * Loads the signed-in user’s row from `public.profiles` (RLS: own row only).
 * Call only when Supabase is configured and the user id is known.
 */
export async function fetchProfileForUserId(userId: string): Promise<ProfileForApp | null> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select(PROFILE_SELECT_FOR_APP)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as ProfileForApp | null;
}
