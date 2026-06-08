/** Structured API error — never triggers sign-out; callers show local UI. */
export class ApiRequestError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, opts?: { status?: number; code?: string }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = opts?.status;
    this.code = opts?.code;
  }
}

/** Extract HTTP status from ApiRequestError, axios-like errors, or message text. */
export function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiRequestError && typeof error.status === "number") {
    return error.status;
  }

  if (error && typeof error === "object") {
    const withStatus = error as { status?: unknown; response?: { status?: unknown } };
    if (typeof withStatus.status === "number") return withStatus.status;
    if (typeof withStatus.response?.status === "number") return withStatus.response.status;
  }

  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  const httpMatch = msg.match(/\(http\s*(\d{3})\)/) ?? msg.match(/http\s+(\d{3})\b/);
  if (httpMatch) return Number(httpMatch[1]);

  if (msg.includes("not signed in") || msg.includes("not authenticated") || msg.includes("jwt expired")) {
    return 401;
  }

  if (msg.includes("permission denied") || msg.includes("row-level security")) {
    return 403;
  }

  return undefined;
}

/** TanStack Query retry — do not hammer 401/403; allow limited retry for transient failures. */
export function queryRetry(failureCount: number, error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return false;
  return failureCount < 2;
}

/** User-facing copy for query/API failures — does not imply the user was signed out. */
export function formatQueryErrorMessage(error: unknown, fallback = "Request failed."): string {
  const status = getErrorStatus(error);
  const raw = error instanceof Error ? error.message.trim() : String(error).trim();

  if (status === 401) {
    return "You are not authorised for this request. Try again or contact support if it persists.";
  }
  if (status === 403) {
    return "You do not have permission to view this data.";
  }
  if (status && status >= 500) {
    return "Server error. Please try again in a moment.";
  }

  const lower = raw.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("timeout")) {
    return "Could not reach the server. Check your connection and try again.";
  }

  return raw || fallback;
}
