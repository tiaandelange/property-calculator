import jwt from "jsonwebtoken";
import type { SubscriptionStatus, UserRole } from "@prisma/client";
import { db } from "../config/db.js";
import { env } from "../config/env.js";

export interface AuthJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  subscription_status: SubscriptionStatus;
}

export type ResolvedBearerUser = {
  userId: number;
  email: string;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
};

export type ResolveBearerUserResult =
  | { ok: true; user: ResolvedBearerUser }
  | { ok: false; reason: "invalid" | "supabase_no_app_user" };

export const NO_APP_USER_MESSAGE =
  "No application user matches this Supabase login. Create a PropertyGuy user with the same email (e.g. prisma seed or legacy /register), then try again.";

function tryLegacyJwt(token: string): AuthJwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthJwtPayload;
  } catch {
    return null;
  }
}

function legacyToResolved(payload: AuthJwtPayload): ResolvedBearerUser | null {
  const id = Number(payload.sub);
  if (Number.isNaN(id)) return null;
  return {
    userId: id,
    email: payload.email,
    role: payload.role,
    subscriptionStatus: payload.subscription_status
  };
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
 * Resolves a Bearer token to a Prisma `User` id + role fields.
 * Supports legacy app JWTs (`JWT_SECRET`) and Supabase access tokens (`SUPABASE_JWT_SECRET`).
 */
export async function resolveBearerUser(token: string): Promise<ResolveBearerUserResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, reason: "invalid" };
  }

  const legacy = tryLegacyJwt(trimmed);
  if (legacy) {
    const resolved = legacyToResolved(legacy);
    if (resolved) return { ok: true, user: resolved };
  }

  const supabaseSecret = env.SUPABASE_JWT_SECRET;
  if (!supabaseSecret) {
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

  const email = emailFromSupabasePayload(payload);
  if (!email) {
    return { ok: false, reason: "invalid" };
  }

  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      role: true,
      subscription_status: true
    }
  });

  if (!user) {
    return { ok: false, reason: "supabase_no_app_user" };
  }

  return {
    ok: true,
    user: {
      userId: user.id,
      email: user.email,
      role: user.role,
      subscriptionStatus: user.subscription_status
    }
  };
}
