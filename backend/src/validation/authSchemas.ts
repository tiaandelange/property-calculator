import { z } from "zod";

/**
 * Auth route validation schemas.
 *
 * Every public auth route uses these so we get one source of truth for password
 * rules, normalization, and length caps. The same schemas are used by the
 * production "generic error" handler — we never echo zod's per-field detail back
 * to anonymous callers because that would help account-enumeration / credential
 * guessing.
 */

/**
 * Email normalisation:
 *   - trim whitespace
 *   - lowercase the entire address (RFC 5321 local-parts are technically case
 *     sensitive but every mainstream provider treats them case-insensitively,
 *     and storing one canonical form prevents duplicate accounts for the same
 *     human).
 *
 * Length cap of 254 matches RFC 5321 SMTP path limit.
 */
const emailField = z
  .string({ required_error: "Email is required.", invalid_type_error: "Email is required." })
  .trim()
  .min(3, "Email is required.")
  .max(254, "Email is too long.")
  .email("Email is not valid.")
  .transform((value) => value.toLowerCase());

/**
 * Registration password policy. Login does NOT apply this — existing accounts
 * may have been created under a looser policy and we still need to let them in.
 *
 *   - 8 character minimum (OWASP "absolute floor"; raise to 12 once the user
 *     base allows it).
 *   - 200 character upper bound. Stops "DoS via bcrypt cost on a 1 MB string"
 *     and stays well under bcrypt's 72-byte input ceiling for the useful entropy
 *     bits.
 *   - Requires at least one letter AND one digit so the most obvious weak
 *     passwords ("password", "12345678") are refused.
 */
const registrationPasswordField = z
  .string({ required_error: "Password is required.", invalid_type_error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password is too long.")
  .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
    message: "Password must contain at least one letter and one digit."
  });

const loginPasswordField = z
  .string({ required_error: "Password is required.", invalid_type_error: "Password is required." })
  .min(1, "Password is required.")
  .max(200, "Password is too long.");

const nameField = z
  .string()
  .trim()
  .min(1, "Name is required when provided.")
  .max(120, "Name is too long.")
  .optional()
  .nullable();

export const registerSchema = z
  .object({
    email: emailField,
    password: registrationPasswordField,
    name: nameField
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailField,
    password: loginPasswordField
  })
  .strict();

/** Bare alphanumeric/hyphen UUIDs only — refuses obvious tampering up-front. */
export const confirmationTokenSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Token has an invalid format.");

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
