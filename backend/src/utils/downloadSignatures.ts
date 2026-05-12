import crypto from "node:crypto";
import { env } from "../config/env.js";

/**
 * HMAC-signed download URLs.
 *
 * Use case: the existing `Authorization: Bearer` header pattern works fine for
 * AJAX downloads (axios attaches the JWT), but breaks for use cases where the
 * URL must be hit directly by the browser — e.g. an `<a href>` click, an
 * `<iframe>` embed, or a URL emailed to a tenant. Those flows used to fail with
 * 401 because no Authorization header is attached by the browser.
 *
 * We solve it with a short-lived HMAC signature over
 *   `${kind}|${resourceId}|${userId}|${exp}`
 * encoded into the URL query string. The download handler accepts EITHER a
 * valid JWT header OR a valid signed query — never both at once, never less.
 *
 * The signing key is derived from JWT_SECRET so we don't need a second secret
 * to rotate; rotating JWT_SECRET also invalidates any outstanding signed URLs,
 * which is the conservative behaviour.
 */

export type DownloadKind = "report" | "invoice" | "document";

const DEFAULT_TTL_SECONDS = 5 * 60;
const SIGNING_DOMAIN_TAG = "download-signing-key/v1";

const HMAC_KEY = crypto.createHmac("sha256", env.JWT_SECRET).update(SIGNING_DOMAIN_TAG).digest();

function computeSignature(input: { userId: number; kind: DownloadKind; resourceId: number; exp: number }): string {
  const msg = `${input.kind}|${input.resourceId}|${input.userId}|${input.exp}`;
  return crypto.createHmac("sha256", HMAC_KEY).update(msg).digest("base64url");
}

export interface SignedDownloadParams {
  exp: number;
  uid: number;
  sig: string;
}

export function signDownloadParams(input: {
  userId: number;
  kind: DownloadKind;
  resourceId: number;
  ttlSeconds?: number;
}): SignedDownloadParams {
  if (!Number.isInteger(input.userId) || input.userId <= 0) throw new Error("userId required.");
  if (!Number.isInteger(input.resourceId) || input.resourceId <= 0) throw new Error("resourceId required.");
  const ttl = Number.isFinite(input.ttlSeconds) && (input.ttlSeconds ?? 0) > 0 ? input.ttlSeconds! : DEFAULT_TTL_SECONDS;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = computeSignature({ userId: input.userId, kind: input.kind, resourceId: input.resourceId, exp });
  return { exp, uid: input.userId, sig };
}

export function buildSignedDownloadUrl(basePath: string, parts: SignedDownloadParams): string {
  const params = new URLSearchParams({
    exp: String(parts.exp),
    uid: String(parts.uid),
    sig: parts.sig
  });
  return `${basePath}?${params.toString()}`;
}

export function verifyDownloadSignature(input: {
  kind: DownloadKind;
  resourceId: number;
  query: Record<string, unknown> | undefined;
}): { userId: number } | null {
  const q = input.query ?? {};
  const expRaw = q.exp;
  const uidRaw = q.uid;
  const sigRaw = q.sig;
  if (typeof expRaw !== "string" || typeof uidRaw !== "string" || typeof sigRaw !== "string") {
    return null;
  }
  const exp = Number(expRaw);
  const uid = Number(uidRaw);
  if (!Number.isInteger(exp) || exp <= 0) return null;
  if (!Number.isInteger(uid) || uid <= 0) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;

  const expected = computeSignature({ userId: uid, kind: input.kind, resourceId: input.resourceId, exp });
  const a = Buffer.from(expected);
  const b = Buffer.from(sigRaw);
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { userId: uid };
}
