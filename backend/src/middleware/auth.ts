/**
 * Express auth middleware — delegates token resolution to {@link resolveBearerUser}.
 */
import { NextFunction, Request, Response } from "express";
import type { SubscriptionStatus, UserRole } from "../types/domain.js";
import {
  NO_APP_USER_MESSAGE,
  resolveBearerUser,
  type ResolvedBearerUser
} from "../auth/resolveBearerUser.js";

export type { AuthJwtPayload } from "../auth/resolveBearerUser.js";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
  userSubscriptionStatus?: SubscriptionStatus;
}

function clearAuthFields(req: AuthRequest) {
  req.userId = undefined;
  req.userEmail = undefined;
  req.userRole = undefined;
  req.userSubscriptionStatus = undefined;
}

function applyResolvedToRequest(req: AuthRequest, user: ResolvedBearerUser) {
  req.userId = user.userId;
  req.userEmail = user.email;
  req.userRole = user.role;
  req.userSubscriptionStatus = user.subscriptionStatus;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = header.replace("Bearer ", "");
  try {
    const result = await resolveBearerUser(token);
    if (result.ok) {
      applyResolvedToRequest(req, result.user);
      console.log(`[auth] userId=${req.userId} ${req.method} ${req.path}`);
      return next();
    }
    if (result.reason === "profile_missing") {
      return res.status(401).json({ message: NO_APP_USER_MESSAGE });
    }
    return res.status(401).json({ message: "Invalid token" });
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden: admin access required" });
  }
  next();
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  const token = header.replace("Bearer ", "");
  try {
    const result = await resolveBearerUser(token);
    if (result.ok) {
      applyResolvedToRequest(req, result.user);
    } else {
      clearAuthFields(req);
    }
  } catch (err) {
    clearAuthFields(req);
    next(err);
    return;
  }
  next();
}

export const authRequired = requireAuth;
