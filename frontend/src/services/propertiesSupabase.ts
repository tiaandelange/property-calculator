import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import {
  buildPropertyInsertRow,
  buildPropertyUpdatePatch,
  enrichPropertyDetail,
  enrichPropertyListItem,
  buildPropertyFieldsFromBody,
  snakeRowToCamel
} from "../api/propertyRowMapping";
import * as leasesSupabase from "./leasesSupabase";
import * as invoicesSupabase from "./invoicesSupabase";

function toError(e: PostgrestError | Error): Error {
  if ("code" in e && "message" in e) {
    const pe = e as PostgrestError;
    const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return e instanceof Error ? e : new Error(String(e));
}

async function requireUserId(): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Not signed in.");
  return data.user.id;
}

/**
 * Maps a raw `properties` table row (snake_case keys) to the SPA camelCase shape.
 * @param variant `list` — card row + empty aggregates; `detail` — workspace detail + empty relations.
 */
export function dbToProperty(row: Record<string, unknown>, variant: "list" | "detail"): Record<string, unknown> {
  const camel = snakeRowToCamel(row);
  return variant === "detail" ? enrichPropertyDetail(camel) : enrichPropertyListItem(camel);
}

/** Maps a camelCase property payload to DB column names (no `user_id`). */
export function propertyToDb(payload: Record<string, unknown>): Record<string, unknown> {
  return buildPropertyFieldsFromBody(payload);
}

/** Lists properties for the signed-in user (RLS + `user_id` filter). `month` is ignored until dashboard-summary migrates. */
export async function listProperties(_params?: { month?: string }): Promise<Record<string, unknown>[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("properties")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  return (data ?? []).map((row) => dbToProperty(row as Record<string, unknown>, "list"));
}

/** Fetches one property by id for the signed-in user. */
export async function getProperty(
  id: string | number,
  _opts?: { bustCache?: boolean; month?: string }
): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("properties")
    .select("*")
    .eq("id", String(id))
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw toError(error);
  if (!data) {
    throw new Error("Property not found");
  }
  const base = dbToProperty(data as Record<string, unknown>, "detail");
  const leaseBundle = await leasesSupabase.listLeasesForProperty(String(id));
  const merged = leasesSupabase.mergeLeaseBundleIntoPropertyDetail(base, leaseBundle);
  const invoices = await invoicesSupabase.listInvoices(String(id));
  return { ...merged, invoices };
}

/** Inserts a property with `user_id = auth.uid()`. */
export async function createProperty(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const row = buildPropertyInsertRow(uid, payload);
  const { data, error } = await sb.from("properties").insert(row).select("*").single();
  if (error) throw toError(error);
  return dbToProperty(data as Record<string, unknown>, "detail");
}

/** Updates a property owned by the signed-in user. */
export async function updateProperty(id: string | number, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const patch = buildPropertyUpdatePatch(payload);
  const { data, error } = await sb
    .from("properties")
    .update(patch)
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return dbToProperty(data as Record<string, unknown>, "detail");
}

/**
 * Hard-deletes a property (matches current UX copy: permanent delete).
 * RLS restricts to the owner row.
 */
export async function deleteProperty(id: string | number): Promise<void> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { error } = await sb.from("properties").delete().eq("id", String(id)).eq("user_id", uid);
  if (error) throw toError(error);
}
