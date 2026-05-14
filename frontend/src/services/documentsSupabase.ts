import { getSupabase } from "../lib/supabaseClient";

const BUCKET = "property-documents";
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png"
]);

const DOC_TYPES = new Set([
  "LEASE_AGREEMENT",
  "ID_DOCUMENT",
  "PROOF_OF_PAYMENT",
  "MUNICIPAL_ACCOUNT",
  "INSURANCE",
  "INSPECTION",
  "OTHER"
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object" && "message" in e) {
    const pe = e as { message?: string; hint?: string; details?: string };
    const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return new Error(String(e));
}

function requireUuid(label: string, id: string): void {
  if (!UUID_RE.test(id.trim())) throw new Error(`${label} must be a UUID.`);
}

/** Safe single path segment for Storage (no slashes / control chars). */
export function sanitizeFilenameForStorage(name: string, maxLen = 180): string {
  const base = (name || "document").split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\- ()\[\]]+/g, "_").replace(/^\.+/, "").trim();
  const s = cleaned.length ? cleaned : "document";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function assertAllowedPropertyDocumentFile(file: File): void {
  if (!file || !(file instanceof File)) throw new Error("No file selected.");
  if (file.size <= 0) throw new Error("File is empty.");
  if (file.size > MAX_BYTES) throw new Error("File too large (max 10 MB).");
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) throw new Error("Unsupported file type.");
  if (file.name && file.name.length > 255) throw new Error("Filename too long.");
}

export function buildPropertyDocumentStorageKey(
  userId: string,
  propertyId: string,
  documentId: string,
  originalFilename: string
): string {
  const safe = sanitizeFilenameForStorage(originalFilename);
  return `${userId}/properties/${propertyId}/${documentId}-${safe}`;
}

export type ClientPropertyDocument = {
  id: string;
  propertyId: string;
  leaseId: string | null;
  documentType: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  storageBucket: string | null;
  storageKey: string | null;
};

function mapRow(row: Record<string, unknown>): ClientPropertyDocument {
  return {
    id: String(row.id),
    propertyId: String(row.property_id),
    leaseId: row.lease_id != null ? String(row.lease_id) : null,
    documentType: String(row.document_type ?? "OTHER"),
    fileName: String(row.file_name ?? ""),
    fileSize: Number(row.size_bytes ?? row.file_size ?? 0),
    uploadedAt: String(row.created_at ?? row.updated_at ?? ""),
    storageBucket: row.storage_bucket != null ? String(row.storage_bucket) : null,
    storageKey: row.storage_key != null ? String(row.storage_key) : null
  };
}

/**
 * Upload a file to Storage and insert `property_documents` (RLS + Storage policies).
 */
export async function uploadPropertyDocument(
  propertyId: string,
  file: File,
  opts?: { documentType?: string; leaseId?: string | null }
): Promise<ClientPropertyDocument> {
  requireUuid("propertyId", propertyId);
  assertAllowedPropertyDocumentFile(file);

  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr) throw toError(userErr);
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in.");

  const docType = opts?.documentType && DOC_TYPES.has(opts.documentType) ? opts.documentType : "OTHER";
  let leaseId: string | null = null;
  if (opts?.leaseId && UUID_RE.test(String(opts.leaseId).trim())) {
    leaseId = String(opts.leaseId).trim();
  }

  const docId = crypto.randomUUID();
  const key = buildPropertyDocumentStorageKey(uid, propertyId, docId, file.name);
  const displayName = sanitizeFilenameForStorage(file.name, 200);
  const originalFilename = file.name.slice(0, 255);
  const size = file.size;

  let uploadedKey: string | null = null;
  try {
    const { error: upErr } = await sb.storage.from(BUCKET).upload(key, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream"
    });
    if (upErr) throw toError(upErr);
    uploadedKey = key;

    const { data: inserted, error: insErr } = await sb
      .from("property_documents")
      .insert({
        id: docId,
        user_id: uid,
        property_id: propertyId,
        lease_id: leaseId,
        document_type: docType,
        file_name: displayName,
        file_path: key,
        mime_type: file.type || "application/octet-stream",
        file_size: size,
        storage_bucket: BUCKET,
        storage_key: key,
        original_filename: originalFilename,
        size_bytes: size
      })
      .select("id,property_id,lease_id,document_type,file_name,file_size,size_bytes,created_at,storage_bucket,storage_key")
      .single();

    if (insErr) throw toError(insErr);
    return mapRow(inserted as Record<string, unknown>);
  } catch (e) {
    if (uploadedKey) {
      await sb.storage.from(BUCKET).remove([uploadedKey]);
    }
    throw e instanceof Error ? e : toError(e);
  }
}

export async function listPropertyDocuments(propertyId: string): Promise<ClientPropertyDocument[]> {
  requireUuid("propertyId", propertyId);
  const sb = getSupabase();
  const { data, error } = await sb
    .from("property_documents")
    .select(
      "id,property_id,lease_id,document_type,file_name,file_size,size_bytes,created_at,updated_at,storage_bucket,storage_key"
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) throw toError(error);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/** Signed URL for opening/downloading a private Storage object. */
export async function getSignedDocumentUrl(
  documentId: string,
  expiresInSeconds = 3600
): Promise<{ url: string; expiresAt: string }> {
  requireUuid("documentId", documentId);
  const sb = getSupabase();

  const { data: row, error: selErr } = await sb
    .from("property_documents")
    .select("storage_bucket,storage_key,mime_type,file_name")
    .eq("id", documentId)
    .maybeSingle();

  if (selErr) throw toError(selErr);
  if (!row) throw new Error("Document not found.");

  const r = row as Record<string, unknown>;
  const bucket = (r.storage_bucket as string | null) || BUCKET;
  const objectKey = r.storage_key as string | null;
  if (!objectKey) throw new Error("This document has no cloud storage object (legacy server file).");

  const { data: signed, error: signErr } = await sb.storage.from(bucket).createSignedUrl(objectKey, expiresInSeconds);
  if (signErr) throw toError(signErr);
  if (!signed?.signedUrl) throw new Error("Could not create signed URL.");

  const expMs = Date.now() + expiresInSeconds * 1000;
  return { url: signed.signedUrl, expiresAt: new Date(expMs).toISOString() };
}

export async function deletePropertyDocument(documentId: string): Promise<void> {
  requireUuid("documentId", documentId);
  const sb = getSupabase();

  const { data: row, error: selErr } = await sb
    .from("property_documents")
    .select("storage_bucket,storage_key")
    .eq("id", documentId)
    .maybeSingle();

  if (selErr) throw toError(selErr);
  if (!row) throw new Error("Document not found.");

  const r = row as Record<string, unknown>;
  const bucket = (r.storage_bucket as string | null) || BUCKET;
  const objectKey = r.storage_key as string | null;

  const { error: delErr } = await sb.from("property_documents").delete().eq("id", documentId);
  if (delErr) throw toError(delErr);

  if (objectKey) {
    const { error: rmErr } = await sb.storage.from(bucket).remove([objectKey]);
    if (rmErr) {
      console.warn("[documentsSupabase] storage remove after delete failed", rmErr.message);
    }
  }
}
