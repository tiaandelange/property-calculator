/** Finite timeout for the initial auth bootstrap `getSession()` call. */
export const AUTH_BOOTSTRAP_TIMEOUT_MS = 6_000;

/** User-facing copy when account/auth services cannot be reached. */
export const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  "Account services are temporarily unavailable. Please try again later.";

/** User-facing copy for protected routes when the backend is down. */
export const BACKEND_UNAVAILABLE_MESSAGE =
  "Account services are temporarily unavailable. The public Proplytic tools remain available, but sign-in and saved account data cannot currently be accessed.";

export type AuthStatus =
  | "idle"
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "backend-unavailable";

/**
 * True when an auth/network error indicates Supabase is unreachable
 * (paused project, DNS failure, offline, timeout) rather than invalid credentials.
 */
export function isAuthBackendUnavailableError(error: unknown): boolean {
  if (error == null) return false;
  const msg =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : String(error);

  const m = msg.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network error") ||
    m.includes("load failed") ||
    m.includes("err_name_not_resolved") ||
    m.includes("err_connection") ||
    m.includes("err_internet_disconnected") ||
    m.includes("auth bootstrap timed out") ||
    m.includes("timed out") ||
    m.includes("timeout") ||
    m.includes("fetch failed") ||
    m.includes("aborted")
  );
}

export function authBootstrapTimeoutError(): Error {
  return new Error("Auth bootstrap timed out waiting for getSession()");
}

/**
 * Race a promise against a timeout. Does not cancel the underlying work.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(onTimeout());
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}
