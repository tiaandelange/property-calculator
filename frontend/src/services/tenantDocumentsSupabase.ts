import { requireUserIdFromSession } from "../lib/authSession";
import { getSupabase } from "../lib/supabaseClient";
import {
  assertAllowedPropertyDocumentFile,
  buildPropertyDocumentStorageKey,
  sanitizeFilenameForStorage
} from "./documentsSupabase";
import type { ApplicantDocumentSlotId } from "../features/applicants/applicantDocumentSlots";
import { APPLICANT_DOCUMENT_SLOTS } from "../features/applicants/applicantDocumentSlots";
import {
  LEASE_CONTRACT_SLOT,
  type TenantDocumentSlotId
} from "../features/documents/tenantDocumentSlots";

const BUCKET = "tenant-documents";

export type TenantDocumentRecord = {
  id: string;
  documentSlot: TenantDocumentSlotId;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  storageBucket: string | null;
  storageKey: string | null;
  originalFilename: string | null;
  source?: string;
  uploadedAt: string;
  leaseId?: string | null;
};

function mapRow(row: Record<string, unknown>): TenantDocumentRecord {
  return {
    id: String(row.id ?? ""),
    documentSlot: String(row.documentSlot ?? row.document_slot ?? "") as TenantDocumentSlotId,
    leaseId:
      row.leaseId != null
        ? String(row.leaseId)
        : row.lease_id != null
          ? String(row.lease_id)
          : null,
    fileName: String(row.fileName ?? row.file_name ?? ""),
    mimeType: row.mimeType != null ? String(row.mimeType) : row.mime_type != null ? String(row.mime_type) : null,
    sizeBytes: Number(row.sizeBytes ?? row.size_bytes ?? 0),
    storageBucket:
      row.storageBucket != null ? String(row.storageBucket) : row.storage_bucket != null ? String(row.storage_bucket) : BUCKET,
    storageKey: row.storageKey != null ? String(row.storageKey) : row.storage_key != null ? String(row.storage_key) : null,
    originalFilename:
      row.originalFilename != null
        ? String(row.originalFilename)
        : row.original_filename != null
          ? String(row.original_filename)
          : null,
    source: row.source != null ? String(row.source) : undefined,
    uploadedAt: String(row.uploadedAt ?? row.uploaded_at ?? "")
  };
}

function buildTenantDocumentStorageKey(userId: string, tenantId: string, documentId: string, filename: string): string {
  const safe = sanitizeFilenameForStorage(filename);
  return `${userId}/tenants/${tenantId}/${documentId}-${safe}`;
}

function buildLeaseContractStorageKey(
  userId: string,
  tenantId: string,
  leaseId: string,
  documentId: string,
  filename: string
): string {
  const safe = sanitizeFilenameForStorage(filename);
  return `${userId}/tenants/${tenantId}/leases/${leaseId}/${documentId}-${safe}`;
}

function parseDocumentList(data: unknown): TenantDocumentRecord[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data.map((r) => mapRow(r as Record<string, unknown>));
  if (typeof data === "string") {
    try {
      return parseDocumentList(JSON.parse(data) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

export async function listTenantDocumentsOwner(tenantId: string): Promise<TenantDocumentRecord[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("list_tenant_documents_owner", { p_tenant_id: tenantId });
  if (error) throw new Error(error.message);
  return parseDocumentList(data);
}

export async function listApplicantDocumentsPublic(token: string, tenantId: string): Promise<TenantDocumentRecord[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("list_applicant_documents_public", {
    p_token: token,
    p_tenant_id: tenantId
  });
  if (error) throw new Error(error.message);
  return parseDocumentList(data);
}

export async function uploadApplicantDocumentPublic(
  token: string,
  tenantId: string,
  slot: ApplicantDocumentSlotId,
  file: File
): Promise<TenantDocumentRecord> {
  assertAllowedPropertyDocumentFile(file);
  const sb = getSupabase();

  const { data: prepared, error: prepErr } = await sb.rpc("prepare_applicant_document_upload", {
    p_token: token,
    p_tenant_id: tenantId,
    p_slot: slot,
    p_filename: file.name,
    p_mime_type: file.type || "application/octet-stream",
    p_size_bytes: file.size
  });
  if (prepErr) throw new Error(prepErr.message);

  const prep = prepared as Record<string, unknown>;
  const bucket = String(prep.storageBucket ?? BUCKET);
  const storageKey = String(prep.storageKey ?? "");
  const documentId = String(prep.documentId ?? "");
  const uploadToken = String(prep.uploadToken ?? "");

  const { error: upErr } = await sb.storage.from(bucket).upload(storageKey, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream"
  });
  if (upErr) throw new Error(upErr.message);

  const { data: finalized, error: finErr } = await sb.rpc("finalize_applicant_document_upload", {
    p_token: token,
    p_tenant_id: tenantId,
    p_document_id: documentId,
    p_upload_token: uploadToken
  });
  if (finErr) throw new Error(finErr.message);

  return mapRow(finalized as Record<string, unknown>);
}

export async function uploadApplicantDocumentsPublic(
  token: string,
  tenantId: string,
  pendingBySlot: Partial<Record<ApplicantDocumentSlotId, File>>
): Promise<void> {
  for (const { slot } of APPLICANT_DOCUMENT_SLOTS) {
    const file = pendingBySlot[slot];
    if (file) await uploadApplicantDocumentPublic(token, tenantId, slot, file);
  }
}

export async function uploadTenantDocumentOwner(
  tenantId: string,
  slot: ApplicantDocumentSlotId,
  file: File
): Promise<TenantDocumentRecord> {
  assertAllowedPropertyDocumentFile(file);
  const sb = getSupabase();
  const uid = await requireUserIdFromSession();

  const { data: existing, error: existingErr } = await sb
    .from("tenant_documents")
    .select("id, storage_key")
    .eq("tenant_id", tenantId)
    .eq("document_slot", slot)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);

  const existingRow = existing as { id?: string; storage_key?: string } | null;
  const docId = existingRow?.id ?? crypto.randomUUID();
  const oldKey = existingRow?.storage_key ?? null;
  const key = buildTenantDocumentStorageKey(uid, tenantId, docId, file.name);
  const displayName = sanitizeFilenameForStorage(file.name, 200);
  const originalFilename = file.name.slice(0, 255);

  let uploadedKey: string | null = null;
  try {
    const { error: upErr } = await sb.storage.from(BUCKET).upload(key, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/octet-stream"
    });
    if (upErr) throw new Error(upErr.message);
    uploadedKey = key;

    const { data, error } = await sb
      .from("tenant_documents")
      .upsert(
        {
          id: docId,
          user_id: uid,
          tenant_id: tenantId,
          document_slot: slot,
          file_name: displayName,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          storage_bucket: BUCKET,
          storage_key: key,
          original_filename: originalFilename,
          source: "owner",
          uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: "tenant_id,document_slot" }
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    if (oldKey && oldKey !== key) {
      await sb.storage.from(BUCKET).remove([oldKey]);
    }

    const row = data as Record<string, unknown>;
    return mapRow({
      id: row.id,
      documentSlot: row.document_slot,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      storageBucket: row.storage_bucket,
      storageKey: row.storage_key,
      originalFilename: row.original_filename,
      source: row.source,
      uploadedAt: row.uploaded_at
    });
  } catch (e) {
    if (uploadedKey && uploadedKey !== oldKey) {
      await sb.storage.from(BUCKET).remove([uploadedKey]);
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function uploadLeaseContractOwner(
  tenantId: string,
  leaseId: string,
  file: File
): Promise<TenantDocumentRecord> {
  assertAllowedPropertyDocumentFile(file);
  const sb = getSupabase();
  const uid = await requireUserIdFromSession();

  const { data: leaseRow, error: leaseErr } = await sb
    .from("leases")
    .select("id, tenant_id")
    .eq("id", leaseId)
    .eq("user_id", uid)
    .maybeSingle();
  if (leaseErr) throw new Error(leaseErr.message);
  if (!leaseRow) throw new Error("Lease not found.");

  const { data: existing, error: existingErr } = await sb
    .from("tenant_documents")
    .select("id, storage_key")
    .eq("lease_id", leaseId)
    .eq("document_slot", LEASE_CONTRACT_SLOT)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);

  const existingRow = existing as { id?: string; storage_key?: string } | null;
  const docId = existingRow?.id ?? crypto.randomUUID();
  const oldKey = existingRow?.storage_key ?? null;
  const key = buildLeaseContractStorageKey(uid, tenantId, leaseId, docId, file.name);
  const displayName = sanitizeFilenameForStorage(file.name, 200);
  const originalFilename = file.name.slice(0, 255);

  let uploadedKey: string | null = null;
  try {
    const { error: upErr } = await sb.storage.from(BUCKET).upload(key, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/octet-stream"
    });
    if (upErr) throw new Error(upErr.message);
    uploadedKey = key;

    const rowPayload = {
      id: docId,
      user_id: uid,
      tenant_id: tenantId,
      lease_id: leaseId,
      document_slot: LEASE_CONTRACT_SLOT,
      file_name: displayName,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      storage_bucket: BUCKET,
      storage_key: key,
      original_filename: originalFilename,
      source: "lease",
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = existingRow?.id
      ? await sb.from("tenant_documents").update(rowPayload).eq("id", docId).select("*").single()
      : await sb.from("tenant_documents").insert(rowPayload).select("*").single();

    if (error) throw new Error(error.message);

    if (oldKey && oldKey !== key) {
      await sb.storage.from(BUCKET).remove([oldKey]);
    }

    const row = data as Record<string, unknown>;
    return mapRow({
      id: row.id,
      documentSlot: row.document_slot,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      storageBucket: row.storage_bucket,
      storageKey: row.storage_key,
      originalFilename: row.original_filename,
      source: row.source,
      uploadedAt: row.uploaded_at,
      leaseId: row.lease_id
    });
  } catch (e) {
    if (uploadedKey && uploadedKey !== oldKey) {
      await sb.storage.from(BUCKET).remove([uploadedKey]);
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export function findLeaseContractDocument(docs: TenantDocumentRecord[], leaseId: string): TenantDocumentRecord | null {
  return docs.find((d) => d.documentSlot === LEASE_CONTRACT_SLOT && d.leaseId === leaseId) ?? null;
}

export async function getTenantDocumentSignedUrl(document: TenantDocumentRecord, expiresInSeconds = 3600): Promise<string> {
  const sb = getSupabase();
  const bucket = document.storageBucket || BUCKET;
  const objectKey = document.storageKey;
  if (!objectKey) throw new Error("Document has no storage object.");

  const { data, error } = await sb.storage.from(bucket).createSignedUrl(objectKey, expiresInSeconds);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Could not create signed URL.");
  return data.signedUrl;
}

/** @deprecated use buildTenantDocumentStorageKey — kept for parity with property docs helper naming */
export { buildPropertyDocumentStorageKey };
