import type { PostgrestError } from "@supabase/supabase-js";
import { requireUserIdFromSession } from "../lib/authSession";
import { getSupabase } from "../lib/supabaseClient";
import { LEASE_CONTRACT_SLOT } from "../features/documents/tenantDocumentSlots";
import { isLeaseCurrentlyActive, leaseDisplayStatus } from "../utils/leaseDisplay";
import { getTenantDocumentSignedUrl, type TenantDocumentRecord } from "./tenantDocumentsSupabase";

function toError(e: PostgrestError | Error): Error {
  if ("code" in e && "message" in e) {
    const pe = e as PostgrestError;
    const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return e instanceof Error ? e : new Error(String(e));
}

export type ActiveLeaseContractRow = {
  leaseId: string;
  leaseReference: string | null;
  propertyId: string;
  propertyName: string;
  tenantId: string;
  tenantName: string;
  startDate: string | null;
  displayStatus: string;
  contract: {
    id: string;
    fileName: string;
    storageBucket: string | null;
    storageKey: string | null;
    uploadedAt: string;
  } | null;
};

function nestedPersonName(row: Record<string, unknown> | null | undefined, fallback: string): string {
  if (!row || typeof row !== "object") return fallback;
  const first = String(row.first_name ?? row.firstName ?? "").trim();
  const last = String(row.last_name ?? row.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  return full || fallback;
}

function mapLeaseContractRow(
  lease: Record<string, unknown>,
  contract: Record<string, unknown> | null
): ActiveLeaseContractRow {
  const tenants = lease.tenants as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const properties = lease.properties as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const tenantRow = Array.isArray(tenants) ? tenants[0] : tenants;
  const propertyRow = Array.isArray(properties) ? properties[0] : properties;
  const status = String(lease.status ?? "");
  const fixedTermEndDate = lease.fixed_term_end_date ?? lease.fixedTermEndDate;
  const cancellationDate = lease.cancellation_date ?? lease.cancellationDate;

  return {
    leaseId: String(lease.id ?? ""),
    leaseReference: lease.lease_reference != null ? String(lease.lease_reference) : lease.leaseReference != null ? String(lease.leaseReference) : null,
    propertyId: String(lease.property_id ?? lease.propertyId ?? ""),
    propertyName: String(propertyRow?.name ?? "Property"),
    tenantId: String(lease.tenant_id ?? lease.tenantId ?? ""),
    tenantName: nestedPersonName(tenantRow, "Tenant"),
    startDate: lease.start_date != null ? String(lease.start_date) : lease.startDate != null ? String(lease.startDate) : null,
    displayStatus: leaseDisplayStatus({
      status,
      fixedTermEndDate: fixedTermEndDate as string | null,
      cancellationDate: cancellationDate as string | null
    }),
    contract: contract
      ? {
          id: String(contract.id ?? ""),
          fileName: String(contract.file_name ?? contract.fileName ?? contract.original_filename ?? contract.originalFilename ?? "Lease contract"),
          storageBucket:
            contract.storage_bucket != null
              ? String(contract.storage_bucket)
              : contract.storageBucket != null
                ? String(contract.storageBucket)
                : null,
          storageKey:
            contract.storage_key != null
              ? String(contract.storage_key)
              : contract.storageKey != null
                ? String(contract.storageKey)
                : null,
          uploadedAt: String(contract.uploaded_at ?? contract.uploadedAt ?? "")
        }
      : null
  };
}

/** Active leases with optional signed lease contract for the workspace documents directory. */
export async function listActiveLeaseContractsDirectory(): Promise<ActiveLeaseContractRow[]> {
  const uid = await requireUserIdFromSession();
  const sb = getSupabase();

  const { data, error } = await sb
    .from("leases")
    .select(
      `
      id,
      start_date,
      fixed_term_end_date,
      cancellation_date,
      status,
      lease_reference,
      tenant_id,
      property_id,
      tenants ( id, first_name, last_name ),
      properties ( id, name )
    `
    )
    .eq("user_id", uid)
    .in("status", ["ACTIVE", "MONTH_TO_MONTH"])
    .order("start_date", { ascending: false });

  if (error) throw toError(error);

  const activeLeases = (data ?? []).filter((row) =>
    isLeaseCurrentlyActive({
      status: String((row as Record<string, unknown>).status ?? ""),
      fixedTermEndDate: (row as Record<string, unknown>).fixed_term_end_date as string | null,
      cancellationDate: (row as Record<string, unknown>).cancellation_date as string | null
    })
  ) as Record<string, unknown>[];

  if (!activeLeases.length) return [];

  const leaseIds = activeLeases.map((l) => String(l.id));
  const { data: contracts, error: contractErr } = await sb
    .from("tenant_documents")
    .select("id, lease_id, file_name, storage_bucket, storage_key, uploaded_at, original_filename")
    .eq("user_id", uid)
    .eq("document_slot", LEASE_CONTRACT_SLOT)
    .in("lease_id", leaseIds);

  if (contractErr) throw toError(contractErr);

  const contractByLease = new Map<string, Record<string, unknown>>();
  for (const row of contracts ?? []) {
    const leaseId = String((row as Record<string, unknown>).lease_id ?? "");
    if (leaseId) contractByLease.set(leaseId, row as Record<string, unknown>);
  }

  return activeLeases.map((lease) => mapLeaseContractRow(lease, contractByLease.get(String(lease.id)) ?? null));
}

export async function openActiveLeaseContract(row: ActiveLeaseContractRow): Promise<void> {
  if (!row.contract?.storageKey) throw new Error("No signed lease contract uploaded for this lease.");
  const doc: TenantDocumentRecord = {
    id: row.contract.id,
    documentSlot: LEASE_CONTRACT_SLOT,
    leaseId: row.leaseId,
    fileName: row.contract.fileName,
    mimeType: null,
    sizeBytes: 0,
    storageBucket: row.contract.storageBucket,
    storageKey: row.contract.storageKey,
    originalFilename: row.contract.fileName,
    uploadedAt: row.contract.uploadedAt
  };
  const url = await getTenantDocumentSignedUrl(doc);
  window.open(url, "_blank", "noopener,noreferrer");
}
