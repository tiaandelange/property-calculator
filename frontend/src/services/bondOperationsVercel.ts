import { authFetch } from "../lib/authFetch";
import { isUuid } from "../utils/propertyIds";

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

export async function runDueRecurringExpensesForProperty(
  propertyId: string
): Promise<{ createdCount: number; message?: string }> {
  if (!isUuid(propertyId)) throw new Error("Property id must be a UUID.");
  return authFetch("/api/recurring-expenses/run-due", {
    method: "POST",
    body: JSON.stringify({ propertyId })
  }) as Promise<{ createdCount: number; message?: string }>;
}
