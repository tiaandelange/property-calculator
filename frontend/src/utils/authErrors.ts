import type { AuthError } from "@supabase/supabase-js";

/**
 * Maps Supabase Auth errors to short, user-facing copy (no raw stack traces).
 */
export function formatAuthError(err: AuthError | Error | null | undefined): string {
  if (!err) return "Something went wrong. Please try again.";
  const code = "code" in err ? (err as AuthError).code : undefined;
  const msg = err.message?.trim() || "";

  switch (code) {
    case "invalid_credentials":
    case "invalid_grant":
      return "Invalid email or password.";
    case "email_not_confirmed":
      return "Please confirm your email before signing in. Check your inbox for the confirmation link.";
    case "user_already_exists":
      return "An account with this email already exists. Try signing in instead.";
    case "weak_password":
      return "Password is too weak. Use at least 8 characters.";
    case "signup_disabled":
      return "New sign-ups are temporarily disabled.";
    case "otp_expired":
      return "This confirmation link has expired. Request a new confirmation email from the sign-in page.";
    default:
      if (/invalid login credentials/i.test(msg)) return "Invalid email or password.";
      if (/email not confirmed/i.test(msg)) return "Please confirm your email before signing in.";
      if (/already registered/i.test(msg)) return "An account with this email already exists.";
      if (/password/i.test(msg) && /short|weak|least/i.test(msg)) return "Password is too weak. Use at least 8 characters.";
      return msg || "Something went wrong. Please try again.";
  }
}
