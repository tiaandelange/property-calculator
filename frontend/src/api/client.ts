import axios from "axios";
import { resolveApiBaseUrl } from "../lib/apiBase";
import { supabase } from "../lib/supabaseClient";

const apiBase = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: apiBase
});

/**
 * @deprecated Call sites may still pass `headers: authHeader()`; it is a no-op.
 * The interceptor attaches **Supabase** `Authorization: Bearer <access_token>` when a session exists.
 * When `VITE_SUPABASE_*` is unset, profile helpers fall back to legacy Express `/user/profile` with no bearer (legacy path).
 */
export function authHeader(): Record<string, string> | undefined {
  return undefined;
}

/** Refreshes the session when the access token is expired or near expiry (avoids Express returning "Invalid token"). */
async function getValidSupabaseAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data: sessionData, error } = await supabase.auth.getSession();
  if (error || !sessionData.session) return null;
  let session = sessionData.session;
  const exp = session.expires_at;
  if (typeof exp === "number") {
    const expiresAtMs = exp * 1000;
    if (expiresAtMs < Date.now() + 60_000) {
      const { data: refreshed, error: refErr } = await supabase.auth.refreshSession();
      if (!refErr && refreshed.session?.access_token) {
        session = refreshed.session;
      }
    }
  }
  return session.access_token ?? null;
}

/** Attaches `Authorization: Bearer <Supabase access_token>` for Express API calls (until API is fully migrated). */
api.interceptors.request.use(async (config) => {
  if (!supabase) return config;
  const token = await getValidSupabaseAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

