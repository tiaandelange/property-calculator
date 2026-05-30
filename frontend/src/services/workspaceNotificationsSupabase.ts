import type { WorkspaceNotification } from "../features/workspace/workspaceSearchTypes";
import { getSupabase } from "../lib/supabaseClient";

function parseNotifications(raw: unknown): WorkspaceNotification[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "");
      const kind = String(r.kind ?? "");
      const severity = String(r.severity ?? "info");
      const title = String(r.title ?? "").trim();
      const route = String(r.route ?? "").trim();
      const occurredAt = String(r.occurredAt ?? "");
      if (!id || !kind || !title || !route) return null;
      const subtitleRaw = r.subtitle;
      const subtitle =
        subtitleRaw == null || String(subtitleRaw).trim() === "" ? null : String(subtitleRaw).trim();
      return {
        id,
        kind,
        severity,
        title,
        subtitle,
        route,
        occurredAt
      } as WorkspaceNotification;
    })
    .filter((row): row is WorkspaceNotification => row != null);
}

export async function getWorkspaceNotifications(): Promise<WorkspaceNotification[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_workspace_notifications");
  if (error) throw new Error(error.message);
  return parseNotifications(data);
}
