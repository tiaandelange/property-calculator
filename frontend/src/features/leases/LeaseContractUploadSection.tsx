import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { DocumentUploadSectionShell, DocumentUploadSlotRow } from "../../components/documents/DocumentUploadPrimitives";
import { LEASE_CONTRACT_SLOT_DEF } from "../documents/tenantDocumentSlots";
import type { TenantDocumentRecord } from "../../services/tenantDocumentsSupabase";
import {
  findLeaseContractDocument,
  getTenantDocumentSignedUrl,
  listTenantDocumentsOwner,
  uploadLeaseContractOwner
} from "../../services/tenantDocumentsSupabase";

const PENDING_FILE_ID = "pending-lease-contract";

export function LeaseContractUploadSection({
  tenantId,
  leaseId,
  disabled,
  pendingFile,
  onPendingFileChange
}: {
  tenantId: string | null | undefined;
  leaseId: string | null | undefined;
  disabled?: boolean;
  /** When lease does not exist yet (create flow), hold file until after create. */
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
}) {
  const inputId = useId().replace(/:/g, "");
  const [docs, setDocs] = useState<TenantDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isDraft = !leaseId;

  const refresh = useCallback(async () => {
    if (!tenantId || !leaseId) {
      setDocs([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setDocs(await listTenantDocumentsOwner(tenantId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, leaseId]);

  useEffect(() => {
    if (isDraft) return;
    void refresh();
  }, [refresh, isDraft]);

  const uploaded = useMemo(
    () => (leaseId ? findLeaseContractDocument(docs, leaseId) : null),
    [docs, leaseId]
  );

  const files = useMemo(() => {
    if (isDraft && pendingFile) {
      return [{ id: PENDING_FILE_ID, name: pendingFile.name }];
    }
    if (uploaded) {
      return [{ id: uploaded.id, name: uploaded.originalFilename || uploaded.fileName || "Signed lease agreement" }];
    }
    return [];
  }, [isDraft, pendingFile, uploaded]);

  const complete = files.length > 0;
  const uploadsEnabled = Boolean(tenantId) && !disabled;

  const uploadFile = async (file: File) => {
    if (!tenantId || !leaseId) return;
    setBusy(true);
    setError("");
    try {
      await uploadLeaseContractOwner(tenantId, leaseId, file);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const openDocument = async () => {
    if (!uploaded) return;
    try {
      const url = await getTenantDocumentSignedUrl(uploaded);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not open document.");
    }
  };

  if (!tenantId) {
    return (
      <DocumentUploadSectionShell
        title="Signed lease agreement"
        description={LEASE_CONTRACT_SLOT_DEF.description}
        embedded
      >
        <DocumentUploadSlotRow
          title={LEASE_CONTRACT_SLOT_DEF.label}
          description="Select a primary tenant first to attach a signed contract."
          complete={false}
          files={[]}
          readOnly
          uploadsEnabled={false}
          inputId={`${inputId}-disabled`}
          onFiles={() => {}}
        />
      </DocumentUploadSectionShell>
    );
  }

  return (
    <DocumentUploadSectionShell
      title="Signed lease agreement"
      description={
        isDraft
          ? `${LEASE_CONTRACT_SLOT_DEF.description} The file will upload when you save the lease.`
          : LEASE_CONTRACT_SLOT_DEF.description
      }
      embedded
      error={error}
      loading={!isDraft && loading && !docs.length}
    >
      <DocumentUploadSlotRow
        title={LEASE_CONTRACT_SLOT_DEF.label}
        description="Optional — PDF or image of the signed contract."
        complete={complete}
        files={files}
        busy={busy}
        uploadsEnabled={uploadsEnabled}
        inputId={inputId}
        disabledHint={!tenantId ? "Select a primary tenant first" : undefined}
        onRemoveFile={
          isDraft && onPendingFileChange
            ? (id) => {
                if (id === PENDING_FILE_ID) onPendingFileChange(null);
              }
            : undefined
        }
        onFiles={(fileList) => {
          const file = fileList[0];
          if (!file) return;
          if (isDraft) {
            onPendingFileChange?.(file);
            return;
          }
          void uploadFile(file);
        }}
        onView={!isDraft && uploaded ? () => void openDocument() : undefined}
      />
    </DocumentUploadSectionShell>
  );
}
