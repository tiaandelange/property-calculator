import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./supabaseClient";

/**
 * Read the current session from local auth state (no network round-trip).
 * Prefer this over `getUser()` in hot paths — concurrent `getUser()` calls during
 * token refresh can stall and leave pages stuck on loading skeletons.
 */
export async function getLocalAuthSession(): Promise<Session | null> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session ?? null;
}

export async function getLocalAuthUser(): Promise<User | null> {
  const session = await getLocalAuthSession();
  return session?.user ?? null;
}

export async function requireLocalUserId(): Promise<string> {
  const user = await getLocalAuthUser();
  if (!user?.id) throw new Error("Not signed in.");
  return user.id;
}
