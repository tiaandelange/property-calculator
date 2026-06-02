export type ReportsPageErrorKind = "auth" | "server" | "network" | "unknown";

export function classifyReportsError(error: unknown): ReportsPageErrorKind {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  const code = String((error as { code?: string })?.code ?? "").toLowerCase();

  if (
    msg.includes("not signed in") ||
    msg.includes("not authenticated") ||
    msg.includes("jwt") ||
    msg.includes("invalid or expired session") ||
    (msg.includes("session") && (msg.includes("missing") || msg.includes("expired"))) ||
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("http 401") ||
    msg.includes("http 403") ||
    code === "42501" ||
    code === "pgrst301" ||
    code === "401" ||
    code === "403"
  ) {
    return "auth";
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
    case "auth":
      return "You are not authorised to view these reports.";
    case "server":
      return "Reports could not be loaded due to a server error. Please try again.";
    case "network":
      return "Could not reach the server. Check your connection and try again.";
    default:
      return fallback ?? "Failed to load reports.";
  }
}
