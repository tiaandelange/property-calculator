import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { formatAuthError } from "../utils/authErrors";

export type ConfirmEmailRedirect =
  | { kind: "code"; code: string }
  | { kind: "otp"; tokenHash: string; type: string }
  | { kind: "implicit" }
  | { kind: "error"; message: string }
  | { kind: "none" };

const MISSING_PARAMS_MESSAGE =
  "Missing confirmation parameters. Open the link from your email, or go back to sign in.";

/** Parse Supabase auth redirect query + hash on `/confirm-email`. */
export function parseConfirmEmailRedirect(search: string, hash: string): ConfirmEmailRedirect {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));

  const error = params.get("error") ?? hashParams.get("error");
  const errorDescription = params.get("error_description") ?? hashParams.get("error_description");
  if (error || errorDescription) {
    const raw = errorDescription ?? error ?? "Email confirmation failed.";
    try {
      return { kind: "error", message: decodeURIComponent(raw) };
    } catch {
      return { kind: "error", message: raw };
    }
  }

  const code = params.get("code");
  if (code) return { kind: "code", code };

  const tokenHash = params.get("token_hash") ?? hashParams.get("token_hash");
  const type = params.get("type") ?? hashParams.get("type");
  if (tokenHash && type) return { kind: "otp", tokenHash, type };

  if (hashParams.get("access_token") || params.get("access_token")) {
    return { kind: "implicit" };
  }

  return { kind: "none" };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function sessionAfterConfirmation(sb: SupabaseClient) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await sb.auth.getSession();
    if (error) return { ok: false as const, message: formatAuthError(error) };
    if (data.session?.user) return { ok: true as const, session: data.session };
    await delay(attempt === 0 ? 50 : 200);
  }
  return { ok: false as const, message: MISSING_PARAMS_MESSAGE };
}

/** Exchange Supabase redirect params for a session (PKCE, OTP, or hash). */
export async function completeConfirmEmailAuth(
  sb: SupabaseClient,
  redirect: ConfirmEmailRedirect
): Promise<{ ok: true } | { ok: false; message: string }> {
  switch (redirect.kind) {
    case "error":
      return { ok: false, message: redirect.message };
    case "code": {
      const { error } = await sb.auth.exchangeCodeForSession(redirect.code);
      if (error) return { ok: false, message: formatAuthError(error) };
      break;
    }
    case "otp": {
      const { error } = await sb.auth.verifyOtp({
        token_hash: redirect.tokenHash,
        type: redirect.type as EmailOtpType
      });
      if (error) return { ok: false, message: formatAuthError(error) };
      break;
    }
    case "implicit": {
      const result = await sessionAfterConfirmation(sb);
      if (!result.ok) {
        return {
          ok: false,
          message:
            "We could not finish confirming your email from this link. Try opening the link again or sign in after confirming."
        };
      }
      return { ok: true };
    }
    case "none": {
      const result = await sessionAfterConfirmation(sb);
      return result.ok ? { ok: true } : { ok: false, message: MISSING_PARAMS_MESSAGE };
    }
  }

  const result = await sessionAfterConfirmation(sb);
  return result.ok ? { ok: true } : { ok: false, message: MISSING_PARAMS_MESSAGE };
}
