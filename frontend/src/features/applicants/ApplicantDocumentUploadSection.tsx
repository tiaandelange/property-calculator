import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  DocumentUploadSectionShell,
  DocumentUploadSlotRow
} from "../../components/documents/DocumentUploadPrimitives";
import {
  APPLICANT_DOCUMENT_GROUPS,
  applicantDocumentGroupComplete,
  applicantDocumentGroupCompleteFromPending,
  applicantDocumentGroupsCompleteCount,
  applicantDocumentGroupsCompleteCountFromPending,
  applicantDocumentSlotIdsForGroup,
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

function assignPendingGroupFiles(
  group: ApplicantDocumentSlotDef["group"],
  files: FileList,
  pendingBySlot: ApplicantPendingDocuments
): ApplicantPendingDocuments {
  const slots = applicantDocumentSlotIdsForGroup(group);
  const selected = Array.from(files).slice(0, slots.length);
  const next = { ...pendingBySlot };
  for (const slot of slots) {
    delete next[slot];
  }
  for (let i = 0; i < selected.length; i++) {
    next[slots[i]] = selected[i];
  }
  return next;
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
    const slots = applicantDocumentSlotIdsForGroup(group);
    const selected = Array.from(files).slice(0, slots.length);
    if (!selected.length) return;

    setBusyGroup(group);
    setError("");
    try {
      for (let i = 0; i < selected.length; i++) {
        setBusySlot(slots[i]);
        await uploadFileCore(slots[i], selected[i]);
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
        const complete =
          mode === "draft"
            ? applicantDocumentGroupCompleteFromPending(group.id, pendingBySlot ?? {})
            : applicantDocumentGroupComplete(group.id, uploadedSlots);
        const files =
          mode === "draft"
            ? pendingFilesForGroup(group.id, pendingBySlot ?? {})
            : uploadedFilesForGroup(group.id, bySlot);
        const uploadedCount = files.length;
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
            uploadLabel={isMulti ? (uploadedCount > 0 ? "Replace files" : "Choose files") : undefined}
            replaceLabel={isMulti ? "Replace files" : "Replace"}
            disabledHint={mode === "draft" ? undefined : "Complete your application details first"}
            onRemoveFile={
              mode === "draft" && onPendingBySlotChange
                ? (slotId) => onPendingBySlotChange(removePendingSlot(pendingBySlot ?? {}, slotId as ApplicantDocumentSlotId))
                : undefined
            }
            onFiles={(fileList) => {
              if (mode === "draft") {
                if (isMulti) {
                  onPendingBySlotChange?.(assignPendingGroupFiles(group.id, fileList, pendingBySlot ?? {}));
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
            onView={
              mode === "owner" && group.id === "identity" && bySlot.get("ID")
                ? () => void openDocument(bySlot.get("ID")!)
                : undefined
            }
          />
        );
      })}
    </DocumentUploadSectionShell>
  );
}
