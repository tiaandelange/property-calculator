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
    const serverMessage = err.error ?? err.message;
    let message = serverMessage;
    if (!message) {
      if (res.status === 404) {
        message =
          "The billing service endpoint was not found. Please refresh the page and try again.";
      } else {
        message = `Request failed (${res.status}).`;
      }
    }
    throw new ApiRequestError(message, { status: res.status });
  }
  return json;
}
