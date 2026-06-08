import { readAuthSession } from "./authSession";
import { ApiRequestError } from "./queryErrors";

/** Same-origin `/api/*` with Supabase Bearer token (Vercel serverless). */
export async function authFetch(path: string, init?: RequestInit): Promise<unknown> {
  const { session, error } = await readAuthSession();
  if (error) {
    throw new ApiRequestError(error.message, { status: 401, code: error.name });
  }
  const token = session?.access_token;
  if (!token) {
    throw new ApiRequestError("Not signed in.", { status: 401 });
  }

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
    throw new ApiRequestError(
      err.error ?? err.message ?? `Request failed (${res.status}).`,
      { status: res.status }
    );
  }
  return json;
}
