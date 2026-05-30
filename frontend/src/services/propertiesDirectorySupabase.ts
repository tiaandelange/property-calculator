import { getSupabase } from "../lib/supabaseClient";
import type { PropertiesDirectoryParams } from "../lib/queryKeys";
import { PROPERTIES_DIRECTORY_PAGE_SIZE } from "../features/properties/propertiesDirectoryUtils";
import { dbToProperty, type PropertyListItem } from "./propertiesSupabase";

function toError(e: { message?: string; hint?: string; details?: string }): Error {
  const parts = [e.message, e.hint, e.details].filter(Boolean);
  return new Error(parts.join(" — ") || "Database request failed.");
}

function mapPropertyDirectoryItem(item: Record<string, unknown>): PropertyListItem {
  const row = (item.row ?? {}) as Record<string, unknown>;
  const base = dbToProperty(row, "list") as PropertyListItem;
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (key === "row") continue;
    extra[key] = value;
  }
  return { ...base, ...extra };
}

/** Portfolio property directory — single RPC with server-side filter/sort/pagination. */
export async function getPropertiesDirectory(opts?: PropertiesDirectoryParams): Promise<{
  items: PropertyListItem[];
  totalCount: number;
}> {
  const sb = getSupabase();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? PROPERTIES_DIRECTORY_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const { data, error } = await sb.rpc("get_properties_directory", {
    p_limit: pageSize,
    p_offset: offset,
    p_search: opts?.q?.trim() || null,
    p_type: opts?.type && opts.type !== "ALL" ? opts.type : null,
    p_status: opts?.status && opts.status !== "ALL" ? opts.status : null,
    p_sort: opts?.sort ?? "RECENT"
  });
  if (error) throw toError(error);
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Empty properties directory response.");
  }

  const payload = data as Record<string, unknown>;
  const rawItems = (payload.items ?? []) as Record<string, unknown>[];
  return {
    items: rawItems.map(mapPropertyDirectoryItem),
    totalCount: Number(payload.totalCount ?? 0)
  };
}
