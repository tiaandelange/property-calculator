export type ReportsPageErrorKind = "session" | "permission" | "server" | "network" | "unknown";

export function classifyReportsError(error: unknown): ReportsPageErrorKind {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  const code = String((error as { code?: string })?.code ?? "").toLowerCase();

  if (
    msg.includes("not signed in") ||
    msg.includes("not authenticated") ||
    msg.includes("jwt expired") ||
    msg.includes("jwt malformed") ||
    (msg.includes("session") && (msg.includes("missing") || msg.includes("expired"))) ||
    msg.includes("http 401") ||
    code === "pgrst301"
  ) {
    return "session";
  }

  if (
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("http 403") ||
    code === "42501" ||
    code === "403"
  ) {
    return "permission";
  }

  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("aborted")
  ) {
    return "network";
  }

  if (
    msg.includes("500") ||
    msg.includes("internal") ||
    msg.includes("function_invocation_failed") ||
    msg.includes("server error has occurred") ||
    code.startsWith("5")
  ) {
    return "server";
  }

  return "unknown";
}

export function reportsErrorMessage(kind: ReportsPageErrorKind, fallback?: string): string {
  switch (kind) {
    case "session":
      return "Your session could not be verified for this request. Try again or sign in from the menu.";
    case "permission":
      return "You do not have permission to view these reports. Contact support if this persists.";
    case "server":
      return "Reports could not be loaded due to a server error. Please try again.";
    case "network":
      return "Could not reach the server. Check your connection and try again.";
    default:
      return fallback ?? "Failed to load reports.";
  }
}
