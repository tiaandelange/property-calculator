import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  DocumentUploadSectionShell,
  DocumentUploadSlotRow
} from "../../components/documents/DocumentUploadPrimitives";
import {
  APPLICANT_DOCUMENT_GROUPS,
  appendPendingGroupFiles,
  applicantDocumentGroupComplete,
  applicantDocumentGroupCompleteFromPending,
  applicantDocumentGroupsCompleteCount,
  applicantDocumentGroupsCompleteCountFromPending,
  applicantDocumentSlotIdsForGroup,
  emptyApplicantDocumentSlotsForGroup,
  type ApplicantDocumentSlotDef,
  type ApplicantDocumentSlotId,
  type ApplicantPendingDocuments
} from "./applicantDocumentSlots";
import type { TenantDocumentRecord } from "../../services/tenantDocumentsSupabase";
import {
  getTenantDocumentSignedUrl,
  listApplicantDocumentsPublic,
  listTenantDocumentsOwner,
  uploadApplicantDocumentPublic,
  uploadTenantDocumentOwner
} from "../../services/tenantDocumentsSupabase";

function docsBySlot(docs: TenantDocumentRecord[]): Map<ApplicantDocumentSlotId, TenantDocumentRecord> {
  const map = new Map<ApplicantDocumentSlotId, TenantDocumentRecord>();
  for (const doc of docs) {
    if (doc.documentSlot && doc.documentSlot !== "LEASE_CONTRACT") {
      map.set(doc.documentSlot as ApplicantDocumentSlotId, doc);
    }
  }
  return map;
}

function pendingFilesForGroup(
  group: ApplicantDocumentSlotDef["group"],
  pendingBySlot: ApplicantPendingDocuments
): Array<{ id: ApplicantDocumentSlotId; name: string }> {
  return applicantDocumentSlotIdsForGroup(group)
    .map((slot) => {
      const file = pendingBySlot[slot];
      return file ? { id: slot, name: file.name } : null;
    })
    .filter((entry): entry is { id: ApplicantDocumentSlotId; name: string } => Boolean(entry));
}

function uploadedFilesForGroup(
  group: ApplicantDocumentSlotDef["group"],
  bySlot: Map<ApplicantDocumentSlotId, TenantDocumentRecord>
): Array<{ id: ApplicantDocumentSlotId; name: string }> {
  return applicantDocumentSlotIdsForGroup(group)
    .map((slot) => {
      const doc = bySlot.get(slot);
      return doc ? { id: slot, name: doc.originalFilename || doc.fileName || "Document" } : null;
    })
    .filter((entry): entry is { id: ApplicantDocumentSlotId; name: string } => Boolean(entry));
}

function removePendingSlot(
  pendingBySlot: ApplicantPendingDocuments,
  slot: ApplicantDocumentSlotId
): ApplicantPendingDocuments {
  const next = { ...pendingBySlot };
  delete next[slot];
  return next;
}

function multiGroupUploadLabel(uploadedCount: number, slotCount: number): string {
  if (uploadedCount === 0) return "Choose files";
  if (uploadedCount < slotCount) return "Add more";
  return "Replace files";
}

export function ApplicantDocumentUploadSection({
  mode,
  tenantId,
  inviteToken,
  disabled,
  readOnly,
  pendingBySlot,
  onPendingBySlotChange
}: {
  mode: "draft" | "public" | "owner";
  tenantId?: string | null;
  inviteToken?: string;
  disabled?: boolean;
  readOnly?: boolean;
  pendingBySlot?: ApplicantPendingDocuments;
  onPendingBySlotChange?: (next: ApplicantPendingDocuments) => void;
}) {
  const baseId = useId();
  const [docs, setDocs] = useState<TenantDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busySlot, setBusySlot] = useState<ApplicantDocumentSlotId | null>(null);
  const [busyGroup, setBusyGroup] = useState<ApplicantDocumentSlotDef["group"] | null>(null);

  const refresh = useCallback(async () => {
    if (mode === "draft" || !tenantId) {
      setDocs([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const rows =
        mode === "public" && inviteToken
          ? await listApplicantDocumentsPublic(inviteToken, tenantId)
          : await listTenantDocumentsOwner(tenantId);
      setDocs(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, mode, inviteToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const bySlot = useMemo(() => docsBySlot(docs), [docs]);
  const uploadedSlots = useMemo(() => new Set(Array.from(bySlot.keys())), [bySlot]);
  const groupsCompleteCount =
    mode === "draft"
      ? applicantDocumentGroupsCompleteCountFromPending(pendingBySlot ?? {})
      : applicantDocumentGroupsCompleteCount(uploadedSlots);

  const uploadFileCore = async (slot: ApplicantDocumentSlotId, file: File) => {
    if (!tenantId || disabled || readOnly) return;
    if (mode === "public") {
      if (!inviteToken) throw new Error("Missing application link token.");
      await uploadApplicantDocumentPublic(inviteToken, tenantId, slot, file);
    } else if (mode === "owner") {
      await uploadTenantDocumentOwner(tenantId, slot, file);
    }
  };

  const uploadFile = async (slot: ApplicantDocumentSlotId, file: File) => {
    setBusySlot(slot);
    setError("");
    try {
      await uploadFileCore(slot, file);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusySlot(null);
    }
  };

  const uploadMultiple = async (group: ApplicantDocumentSlotDef["group"], files: FileList) => {
    const emptySlots = emptyApplicantDocumentSlotsForGroup(group, bySlot.keys());
    const selected = Array.from(files).slice(0, emptySlots.length);
    if (!selected.length) return;

    setBusyGroup(group);
    setError("");
    try {
      for (let i = 0; i < selected.length; i++) {
        setBusySlot(emptySlots[i]);
        await uploadFileCore(emptySlots[i], selected[i]);
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusySlot(null);
      setBusyGroup(null);
    }
  };

  const openDocument = async (doc: TenantDocumentRecord) => {
    if (mode !== "owner") return;
    try {
      const url = await getTenantDocumentSignedUrl(doc);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not open document.");
    }
  };

  const uploadsEnabled = mode === "draft" ? !disabled && !readOnly : Boolean(tenantId) && !disabled && !readOnly;

  return (
    <DocumentUploadSectionShell
      title="Supporting documents"
      description="Choose your ID, three recent payslips, and three recent bank statements. Each category shows a green check when complete. You can select up to three payslips or bank statements at once."
      progressLabel={`${groupsCompleteCount} of ${APPLICANT_DOCUMENT_GROUPS.length} complete`}
      error={error}
      loading={loading && mode !== "draft" && !docs.length}
    >
      {APPLICANT_DOCUMENT_GROUPS.map((group) => {
        const groupBusy = busyGroup === group.id || (group.id === "identity" && busySlot === "ID");
        const isMulti = group.id === "payslips" || group.id === "bank";
        const slotCount = applicantDocumentSlotIdsForGroup(group.id).length;
        const complete =
          mode === "draft"
            ? applicantDocumentGroupCompleteFromPending(group.id, pendingBySlot ?? {})
            : applicantDocumentGroupComplete(group.id, uploadedSlots);
        const files =
          mode === "draft"
            ? pendingFilesForGroup(group.id, pendingBySlot ?? {})
            : uploadedFilesForGroup(group.id, bySlot);
        const uploadedCount = files.length;
        const allSlotsFilled = uploadedCount >= slotCount;
        const inputId = `${baseId}-${group.id}`.replace(/:/g, "");

        return (
          <DocumentUploadSlotRow
            key={group.id}
            title={group.title}
            description={group.description}
            complete={complete}
            files={files}
            busy={groupBusy}
            readOnly={readOnly}
            uploadsEnabled={uploadsEnabled}
            inputId={inputId}
            multiple={isMulti}
            uploadLabel={isMulti ? multiGroupUploadLabel(uploadedCount, slotCount) : undefined}
            replaceLabel={isMulti ? undefined : "Replace"}
            showUploadTrigger={!isMulti || !allSlotsFilled}
            disabledHint={mode === "draft" ? undefined : "Complete your application details first"}
            onViewFile={
              mode === "owner"
                ? (slotId) => {
                    const doc = bySlot.get(slotId as ApplicantDocumentSlotId);
                    if (doc) void openDocument(doc);
                  }
                : undefined
            }
            onRemoveFile={
              mode === "draft" && onPendingBySlotChange
                ? (slotId) => onPendingBySlotChange(removePendingSlot(pendingBySlot ?? {}, slotId as ApplicantDocumentSlotId))
                : undefined
            }
            onFiles={(fileList) => {
              if (mode === "draft") {
                if (isMulti) {
                  onPendingBySlotChange?.(appendPendingGroupFiles(group.id, fileList, pendingBySlot ?? {}));
                } else {
                  const file = fileList[0];
                  if (file) onPendingBySlotChange?.({ ...(pendingBySlot ?? {}), ID: file });
                }
                return;
              }
              if (isMulti) void uploadMultiple(group.id, fileList);
              else {
                const file = fileList[0];
                if (file) void uploadFile("ID", file);
              }
            }}
          />
        );
      })}
    </DocumentUploadSectionShell>
  );
}
