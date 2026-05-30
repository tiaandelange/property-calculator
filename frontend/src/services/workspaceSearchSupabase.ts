import type { WorkspaceSearchHit, WorkspaceSearchKind } from "../features/workspace/workspaceSearchTypes";
import { getSupabase } from "../lib/supabaseClient";

const SEARCH_KINDS = new Set<WorkspaceSearchKind>([
  "property",
  "tenant",
  "applicant",
  "lease",
  "invoice",
  "report"
]);

function parseHits(raw: unknown): WorkspaceSearchHit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const kind = String(r.kind ?? "") as WorkspaceSearchKind;
      if (!SEARCH_KINDS.has(kind)) return null;
      const id = String(r.id ?? "");
      const title = String(r.title ?? "").trim();
      const route = String(r.route ?? "").trim();
      if (!kind || !id || !title || !route) return null;
      const subtitleRaw = r.subtitle;
      const subtitle =
        subtitleRaw == null || String(subtitleRaw).trim() === "" ? null : String(subtitleRaw).trim();
      return { kind, id, title, subtitle, route };
    })
    .filter((row): row is WorkspaceSearchHit => row != null);
}

export async function searchWorkspace(query: string, limitPerKind = 5): Promise<WorkspaceSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const sb = getSupabase();
  const { data, error } = await sb.rpc("search_workspace", {
    p_query: q,
    p_limit_per_kind: limitPerKind
  });
  if (error) throw new Error(error.message);
  return parseHits(data);
}
