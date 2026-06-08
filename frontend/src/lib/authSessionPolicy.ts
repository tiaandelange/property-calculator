import type { Session } from "@supabase/supabase-js";

/** Whether INITIAL_SESSION may replace the in-memory session (never downgrade to null if cached). */
export function sessionFromInitialAuthEvent(
  next: Session | null | undefined,
  cached: Session | null
): Session | null {
  if (next) return next;
  if (cached) return cached;
  return null;
}

/** True when Supabase reports the refresh token is permanently invalid. */
export function isInvalidRefreshTokenError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("invalid refresh token") ||
    m.includes("refresh token not found") ||
    m.includes("refresh_token_not_found") ||
    m.includes("session not found")
  );
}

/**
 * getSession errors must not clear React session state — Supabase emits SIGNED_OUT when
 * the refresh token is truly dead. Clearing here caused login redirect loops when a stale
 * bootstrap getSession resolved after a successful sign-in.
 */
export function shouldClearSessionForGetSessionError(
  _message: string,
  _cached: Session | null
): boolean {
  return false;
}

const RECENT_SESSION_GRACE_MS = 30_000;

/** Ignore SIGNED_OUT immediately after we established a session (token rotation races). */
export function shouldIgnoreSignedOutEvent(
  cached: Session | null,
  sessionEstablishedAtMs: number | null,
  loginInProgress: boolean
): boolean {
  if (loginInProgress) return true;
  if (!cached?.user?.id) return false;
  if (sessionEstablishedAtMs == null) return false;
  return Date.now() - sessionEstablishedAtMs < RECENT_SESSION_GRACE_MS;
}
