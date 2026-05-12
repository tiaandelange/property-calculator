import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { db } from "../config/db.js";
import { readInvoicePaymentDetails } from "../utils/invoicePaymentDetails.js";
import { env } from "../config/env.js";
import type { AuthJwtPayload } from "../middleware/auth.js";
import { registerSchema, loginSchema, confirmationTokenSchema } from "../validation/authSchemas.js";

export const authRoutes = Router();

/**
 * Precomputed bcrypt hash for an unrelated value. Used as a timing-equaliser
 * dummy compare when the supplied email does not match any user, so the
 * response time for "user not found" and "user found, wrong password" is
 * indistinguishable to a network observer.
 *
 * Recomputed once at module load so test/dev runs do not stall on the bcrypt
 * cost every time the module is imported.
 */
const DUMMY_BCRYPT_HASH = bcrypt.hashSync("__timing-equaliser__", 10);

/**
 * One sentence served to anonymous callers in every "bad credentials" case.
 * Identical responses prevent the caller from distinguishing:
 *   - "no such email"
 *   - "right email, wrong password"
 *   - "right email, right password, account exists in another shape"
 * which is the classic account-enumeration / credential-stuffing oracle.
 */
const INVALID_CREDENTIALS_MESSAGE = "Invalid credentials";

authRoutes.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      // We do NOT echo per-field zod issues here. Telling an anonymous caller
      // exactly which field is wrong on /register helps them probe for which
      // emails are already registered. A single generic message is enough.
      return res.status(400).json({ message: "Could not create account with the details provided." });
    }

    const { email, password, name } = parsed.data;
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });

    if (!existing) {
      const password_hash = await bcrypt.hash(password, 10);
      const confirmation_token = crypto.randomUUID();
      await db.user.create({ data: { email, name: name ?? null, password_hash, confirmation_token } });
      // NOTE: this log line stays for now to preserve the existing dev workflow.
      // Replacing it with a real email delivery + hashed token is tracked as H5
      // in the security audit and will be implemented separately.
      console.log(`Confirm email for ${email}: ${env.FRONTEND_URL}/confirm-email/${confirmation_token}`);
    }

    // Always respond identically whether or not the email already had an
    // account. The genuine signal goes via the confirmation email; an attacker
    // probing for valid addresses gets the same 201 either way.
    return res.status(201).json({
      message: "If this email is available, a confirmation link has been sent. Please check your inbox."
    });
  } catch (err) {
    return next(err);
  }
});

authRoutes.get("/confirm-email/:token", async (req, res, next) => {
  try {
    const parsedToken = confirmationTokenSchema.safeParse(req.params.token);
    if (!parsedToken.success) {
      return res.status(400).json({ message: "Invalid token" });
    }
    const user = await db.user.findFirst({
      where: { confirmation_token: parsedToken.data },
      select: { id: true }
    });
    if (!user) return res.status(400).json({ message: "Invalid token" });
    await db.user.update({ where: { id: user.id }, data: { email_confirmed: true, confirmation_token: null } });
    return res.json({ message: "Email confirmed" });
  } catch (err) {
    return next(err);
  }
});

authRoutes.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    }
    const { email, password } = parsed.data;

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password_hash: true,
        email_confirmed: true,
        role: true,
        subscription_status: true,
        free_uses_remaining: true
      }
    });

    // Always run bcrypt — once against the real hash if we have one, or against
    // the dummy hash otherwise. This keeps the total handler time roughly
    // constant whether or not the user exists.
    const valid = user
      ? await bcrypt.compare(password, user.password_hash)
      : (await bcrypt.compare(password, DUMMY_BCRYPT_HASH), false);

    if (!user || !valid) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    }

    // The email-confirmation check is intentionally performed AFTER the
    // password is validated. Before this change the route returned a different
    // status for "unconfirmed" vs "wrong password", which let anyone probe the
    // user table for existing email addresses.
    if (!user.email_confirmed) {
      return res.status(403).json({ message: "Email address not confirmed. Please confirm your email first." });
    }

    const payload: AuthJwtPayload = {
      sub: String(user.id),
      email: user.email,
      role: user.role,
      subscription_status: user.subscription_status
    };
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscription_status,
        freeUsesRemaining: user.free_uses_remaining
      }
    });
  } catch (err) {
    return next(err);
  }
});

authRoutes.get("/me", async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
    const token = header.slice("Bearer ".length).trim();
    let payload: AuthJwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as AuthJwtPayload;
    } catch {
      return res.status(401).json({ message: "Invalid token" });
    }
    const user = await db.user.findUnique({
      where: { id: Number(payload.sub) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscription_status: true,
        free_uses_remaining: true,
        email_confirmed: true,
        uiColorScheme: true
      }
    });
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const invoicePaymentDetails = await readInvoicePaymentDetails(user.id);
    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionStatus: user.subscription_status,
      freeUsesRemaining: user.free_uses_remaining,
      emailConfirmed: user.email_confirmed,
      invoicePaymentDetails: invoicePaymentDetails ?? null,
      uiColorScheme: user.uiColorScheme === "light" ? "light" : "dark"
    });
  } catch (err) {
    return next(err);
  }
});
