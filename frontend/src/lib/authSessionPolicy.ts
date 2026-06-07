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

/** Avoid clearing a fresh in-memory session when a stale getSession resolves late. */
export function shouldClearSessionForGetSessionError(
  message: string,
  cached: Session | null
): boolean {
  if (!isInvalidRefreshTokenError(message)) return false;
  return !cached?.user?.id;
}
