import { getSupabase } from "../lib/supabaseClient";
import { isUuid } from "../utils/propertyIds";

async function authFetch(path: string, init?: RequestInit) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");
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
    throw new Error(err.error ?? err.message ?? `Request failed (${res.status}).`);
  }
  return json;
}

export async function previewBondAtDate(propertyId: string, dueDate: string) {
  if (!isUuid(propertyId)) throw new Error("Property id must be a UUID.");
  const qs = new URLSearchParams({ dueDate });
  return authFetch(`/api/properties/${encodeURIComponent(propertyId)}/bond/preview-at-date?${qs}`);
}

export async function postBondStatementRow(propertyId: string, dueDate: string) {
  if (!isUuid(propertyId)) throw new Error("Property id must be a UUID.");
  return authFetch(`/api/properties/${encodeURIComponent(propertyId)}/bond/statement-row`, {
    method: "POST",
    body: JSON.stringify({ dueDate })
  });
}

export async function backfillBondStatementRows(propertyId: string, startDate: string, endDate: string) {
  if (!isUuid(propertyId)) throw new Error("Property id must be a UUID.");
  return authFetch(`/api/properties/${encodeURIComponent(propertyId)}/bond/backfill-statement-rows`, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate })
  });
}

export async function runDueRecurringExpensesViaVercel(): Promise<{ createdCount: number; message?: string }> {
  return authFetch("/api/recurring-expenses/run-due", { method: "POST" }) as Promise<{
    createdCount: number;
    message?: string;
  }>;
}
