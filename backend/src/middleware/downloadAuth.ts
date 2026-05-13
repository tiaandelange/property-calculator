import { NextFunction, Response } from "express";
import { resolveBearerUser } from "../auth/resolveBearerUser.js";
import { verifyDownloadSignature, type DownloadKind } from "../utils/downloadSignatures.js";
import type { AuthRequest } from "./auth.js";

/**
 * Download-endpoint authentication.
 *
 * Accepts EITHER:
 *   - A valid `Authorization: Bearer <jwt>` header (legacy app JWT or Supabase access token), OR
 *   - A short-lived signed query string (`?exp=&uid=&sig=`) bound to the
 *     specific resource kind + numeric id from the URL.
 *
 * It is intentionally NOT possible to mix the two; whichever signal is valid
 * sets `req.userId`. If neither is valid, the request is rejected with 401.
 *
 * Signature scope is bound by the URL param name supplied to the factory —
 * e.g. `requireDownloadAuth("report", "reportId")` requires that the signature
 * was minted for that exact report id. This prevents a signature issued for
 * report 5 being replayed against report 6.
 */
export function requireDownloadAuth(kind: DownloadKind, idParam: string) {
  return async function downloadAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rawId = req.params[idParam];
      const resourceId = Number(rawId);
      if (!Number.isInteger(resourceId) || resourceId <= 0) {
        return res.status(400).json({ message: "Invalid resource id." });
      }

      const header = req.headers.authorization;
      if (header?.startsWith("Bearer ")) {
        const token = header.slice("Bearer ".length);
        const resolved = await resolveBearerUser(token);
        if (resolved.ok) {
          req.userId = resolved.user.userId;
          req.userEmail = resolved.user.email;
          req.userRole = resolved.user.role;
          req.userSubscriptionStatus = resolved.user.subscriptionStatus;
          return next();
        }
      }

      const verified = verifyDownloadSignature({
        kind,
        resourceId,
        query: req.query as Record<string, unknown>
      });
      if (verified) {
        req.userId = verified.userId;
        return next();
      }

      return res.status(401).json({ message: "Unauthorized" });
    } catch (err) {
      next(err);
    }
  };
}
