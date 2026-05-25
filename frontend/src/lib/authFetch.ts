import { getSupabase } from "./supabaseClient";

/** Same-origin `/api/*` with Supabase Bearer token (Vercel serverless). */
export async function authFetch(path: string, init?: RequestInit): Promise<unknown> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {})
    }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json as { error?: string; message?: string };
    throw new Error(err.error ?? err.message ?? `Request failed (${res.status}).`);
  }
  return json;
}
