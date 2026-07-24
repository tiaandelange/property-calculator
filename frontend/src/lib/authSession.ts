import type { AuthError, Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./supabaseClient";

/** localStorage key Supabase Auth uses for the browser session (derived from project ref). */
export function supabaseAuthStorageKey(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  if (!match?.[1]) return null;
  return `sb-${match[1]}-auth-token`;
}

/**
 * Remove a stale browser auth token without calling Supabase signOut (no network).
 * Used before sign-in to avoid refresh-token races without triggering SIGNED_OUT events.
 */
export function clearStaleLocalAuthStorage(): void {
  try {
    const key = supabaseAuthStorageKey();
    if (key) localStorage.removeItem(key);
  } catch {
    // private mode / quota — non-fatal
  }
}

export type AuthSessionReadResult = {
  session: Session | null;
  error: AuthError | null;
};

/**
 * Coalesces concurrent `getSession()` calls into one in-flight read on the singleton
 * browser client. Parallel reads during `autoRefreshToken` can race and invalidate tokens.
 */
let inflightSessionRead: Promise<AuthSessionReadResult> | null = null;

export async function readAuthSession(): Promise<AuthSessionReadResult> {
  if (inflightSessionRead) return inflightSessionRead;

  const sb = getSupabase();
  inflightSessionRead = sb.auth
    .getSession()
    .then(({ data, error }) => ({
      session: data.session ?? null,
      error: error ?? null
    }))
    .finally(() => {
      inflightSessionRead = null;
    });

  return inflightSessionRead;
}

/** Bearer access token from the shared session read (coalesced). */
export async function readAccessToken(): Promise<string | null> {
  const { session } = await readAuthSession();
  return session?.access_token ?? null;
}

/**
 * Read the current session from the singleton browser client.
 * Prefer this over calling `supabase.auth.getSession()` directly in app code.
 */
export async function getLocalAuthSession(): Promise<Session | null> {
  const { session, error } = await readAuthSession();
  if (error) throw new Error(error.message);
  return session;
}

export async function getLocalAuthUser(): Promise<User | null> {
  const session = await getLocalAuthSession();
  return session?.user ?? null;
}

export async function requireUserIdFromSession(): Promise<string> {
  const session = await getLocalAuthSession();
  if (!session?.user?.id) throw new Error("Not signed in.");
  return session.user.id;
}

/** @deprecated Prefer {@link requireUserIdFromSession} */
export async function requireLocalUserId(): Promise<string> {
  return requireUserIdFromSession();
}

/** Test-only / recovery: reset coalescing state (e.g. after a timed-out bootstrap). */
export function resetAuthSessionReadCoalescingForTests(): void {
  inflightSessionRead = null;
}

/**
 * Drop a stuck in-flight `getSession` coalescing promise so later reads can proceed.
 * Safe to call after a bootstrap timeout or confirmed network failure.
 */
export function abandonInflightAuthSessionRead(): void {
  inflightSessionRead = null;
}
