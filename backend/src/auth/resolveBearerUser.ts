import jwt from "jsonwebtoken";
import { getSupabaseAdminClient, isSupabaseServiceConfigured } from "../config/supabaseClient.js";
import { env } from "../config/env.js";
import type { SubscriptionStatus, UserRole } from "../types/domain.js";

export interface AuthJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  subscription_status: SubscriptionStatus;
}

/** Authenticated user id — Supabase `profiles.id` / `auth.users.id` (UUID). */
export type ResolvedBearerUser = {
  userId: string;
  email: string;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
};

export type ResolveBearerUserResult =
  | { ok: true; user: ResolvedBearerUser }
  | { ok: false; reason: "invalid" | "profile_missing" };

export const NO_APP_USER_MESSAGE =
  "No application profile for this account. Sign out and sign in again, or contact support.";

function tryLegacyJwt(token: string): AuthJwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthJwtPayload;
  } catch {
    return null;
  }
}

function audAllowsAuthenticatedAudience(aud: jwt.JwtPayload["aud"]): boolean {
  if (aud === "authenticated") return true;
  if (Array.isArray(aud) && aud.includes("authenticated")) return true;
  return false;
}

function emailFromSupabasePayload(payload: jwt.JwtPayload): string {
  const top = typeof payload.email === "string" ? payload.email.trim() : "";
  if (top) return top;
  const um = payload.user_metadata;
  if (um && typeof um === "object" && !Array.isArray(um)) {
    const raw = (um as Record<string, unknown>).email;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
}

/**
 * Resolves a Bearer token to app profile fields.
 * Primary path: Supabase access JWT (`sub` → `public.profiles`).
 * Legacy path: app JWT (`JWT_SECRET`) with numeric `sub` is no longer supported for data APIs.
 */
export async function resolveBearerUser(token: string): Promise<ResolveBearerUserResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, reason: "invalid" };
  }

  const legacy = tryLegacyJwt(trimmed);
  if (legacy) {
    return { ok: false, reason: "invalid" };
  }

  const supabaseSecret = env.SUPABASE_JWT_SECRET;
  if (!supabaseSecret || !isSupabaseServiceConfigured) {
    return { ok: false, reason: "invalid" };
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(trimmed, supabaseSecret, {
      algorithms: ["HS256"],
      clockTolerance: 30
    }) as jwt.JwtPayload;
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (!audAllowsAuthenticatedAudience(payload.aud)) {
    return { ok: false, reason: "invalid" };
  }

  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!sub) {
    return { ok: false, reason: "invalid" };
  }

  const email = emailFromSupabasePayload(payload);

  const sb = getSupabaseAdminClient();
  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, role, subscription_status")
    .eq("id", sub)
    .maybeSingle();

  if (error) {
    console.error("[auth] profile lookup failed", error.message);
    return { ok: false, reason: "invalid" };
  }

  if (!profile) {
    return { ok: false, reason: "profile_missing" };
  }

  return {
    ok: true,
    user: {
      userId: String(profile.id),
      email,
      role: profile.role as UserRole,
      subscriptionStatus: profile.subscription_status as SubscriptionStatus
    }
  };
}
