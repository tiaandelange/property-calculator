import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Check, Circle, ExternalLink, Upload, X } from "lucide-react";
import { buttonClassName } from "../../components/ui/buttonStyles";
import { Button } from "../../components/ui/Button";
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

const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png";

function docsBySlot(docs: TenantDocumentRecord[]): Map<ApplicantDocumentSlotId, TenantDocumentRecord> {
  const map = new Map<ApplicantDocumentSlotId, TenantDocumentRecord>();
  for (const doc of docs) {
    if (doc.documentSlot) map.set(doc.documentSlot, doc);
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
): Array<{ slot: ApplicantDocumentSlotId; name: string }> {
  return applicantDocumentSlotIdsForGroup(group)
    .map((slot) => {
      const file = pendingBySlot[slot];
      return file ? { slot, name: file.name } : null;
    })
    .filter((entry): entry is { slot: ApplicantDocumentSlotId; name: string } => Boolean(entry));
}

function uploadedFilesForGroup(
  group: ApplicantDocumentSlotDef["group"],
  bySlot: Map<ApplicantDocumentSlotId, TenantDocumentRecord>
): Array<{ slot: ApplicantDocumentSlotId; name: string }> {
  return applicantDocumentSlotIdsForGroup(group)
    .map((slot) => {
      const doc = bySlot.get(slot);
      return doc ? { slot, name: doc.originalFilename || doc.fileName || "Document" } : null;
    })
    .filter((entry): entry is { slot: ApplicantDocumentSlotId; name: string } => Boolean(entry));
}

function removePendingSlot(
  pendingBySlot: ApplicantPendingDocuments,
  slot: ApplicantDocumentSlotId
): ApplicantPendingDocuments {
  const next = { ...pendingBySlot };
  delete next[slot];
  return next;
}

function SlotIndicator({ uploaded, busy }: { uploaded: boolean; busy?: boolean }) {
  if (busy) {
    return <span className="pg-applicant-doc-slot__indicator pg-applicant-doc-slot__indicator--busy" aria-hidden />;
  }
  if (uploaded) {
    return (
      <span className="pg-applicant-doc-slot__indicator pg-applicant-doc-slot__indicator--done" aria-hidden>
        <Check size={16} strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className="pg-applicant-doc-slot__indicator" aria-hidden>
      <Circle size={16} strokeWidth={2} />
    </span>
  );
}

function FileUploadTrigger({
  inputId,
  label,
  multiple,
  disabled,
  busy,
  disabledHint,
  variant = "outline",
  onFiles
}: {
  inputId: string;
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  disabledHint?: string;
  variant?: "outline" | "soft";
  onFiles: (files: FileList) => void;
}) {
  const inactive = disabled || busy;

  return (
    <label
      className={buttonClassName({
        variant,
        size: "sm",
        className: `pg-applicant-doc-upload-btn${inactive ? " is-disabled" : ""}`
      })}
      aria-disabled={inactive || undefined}
      title={disabled ? disabledHint : undefined}
    >
      <input
        id={inputId}
        type="file"
        accept={FILE_ACCEPT}
        multiple={multiple}
        disabled={inactive}
        className="pg-applicant-doc-upload-btn__input"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <span className="pg-applicant-doc-upload-btn__content">
        <Upload size={14} aria-hidden />
        {busy ? "Uploading…" : label}
      </span>
    </label>
  );
}

function DocumentGroupRow({
  group,
  complete,
  files,
  uploadedCount,
  busy,
  readOnly,
  uploadsEnabled,
  mode,
  inputId,
  onFiles,
  onRemoveSlot,
  onView
}: {
  group: (typeof APPLICANT_DOCUMENT_GROUPS)[number];
  complete: boolean;
  files: Array<{ slot: ApplicantDocumentSlotId; name: string }>;
  uploadedCount: number;
  busy?: boolean;
  readOnly?: boolean;
  uploadsEnabled: boolean;
  mode: "draft" | "public" | "owner";
  inputId: string;
  onFiles: (files: FileList) => void;
  onRemoveSlot?: (slot: ApplicantDocumentSlotId) => void;
  onView?: () => void;
}) {
  const isMulti = group.id === "payslips" || group.id === "bank";
  const canRemove = !readOnly && Boolean(onRemoveSlot);

  return (
    <li className="pg-applicant-doc-slot">
      <SlotIndicator uploaded={complete} busy={busy} />
      <div className="pg-applicant-doc-slot__copy">
        <div className="pg-applicant-doc-slot__label">{group.title}</div>
        <p className="pg-muted pg-applicant-documents__group-desc">{group.description}</p>
        {files.length ? (
          <ul className="pg-applicant-doc-slot__files">
            {files.map(({ slot, name }) => (
              <li key={slot} className="pg-applicant-doc-slot__file-item">
                <span className="pg-applicant-doc-slot__file-name">{name}</span>
                {canRemove ? (
                  <button
                    type="button"
                    className="pg-applicant-doc-slot__file-remove"
                    aria-label={`Remove ${name}`}
                    onClick={() => onRemoveSlot?.(slot)}
                  >
                    <X size={14} aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="pg-applicant-doc-slot__file pg-muted">Not uploaded yet</div>
        )}
      </div>
      <div className="pg-applicant-doc-slot__actions">
        {mode === "owner" && group.id === "identity" && complete ? (
          <Button type="button" variant="ghost" size="sm" onClick={onView}>
            <ExternalLink size={14} aria-hidden style={{ marginRight: 4 }} />
            View
          </Button>
        ) : null}
        {!readOnly ? (
          <FileUploadTrigger
            inputId={inputId}
            label={
              isMulti
                ? uploadedCount > 0
                  ? "Replace files"
                  : "Choose files"
                : complete
                  ? "Replace"
                  : "Choose file"
            }
            multiple={isMulti}
            disabled={!uploadsEnabled}
            busy={busy}
            disabledHint={mode === "draft" ? undefined : "Complete your application details first"}
            variant={complete ? "soft" : "outline"}
            onFiles={onFiles}
          />
        ) : null}
      </div>
    </li>
  );
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
    <section className="pg-applicant-documents" aria-labelledby="applicant-documents-title">
      <div className="pg-applicant-documents__head">
        <div>
          <h2 id="applicant-documents-title" className="pg-applicant-documents__title">
            Supporting documents
          </h2>
          <p className="pg-muted pg-applicant-documents__desc">
            Choose your ID, three recent payslips, and three recent bank statements. Each category shows a green check
            when complete. You can select up to three payslips or bank statements at once.
          </p>
        </div>
        <span className="pg-applicant-documents__progress" aria-live="polite">
          {groupsCompleteCount} of {APPLICANT_DOCUMENT_GROUPS.length} complete
        </span>
      </div>

      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
      {loading && mode !== "draft" && !docs.length ? <p className="pg-muted">Loading documents…</p> : null}

      <ul className="pg-applicant-documents__slots">
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

          return (
            <DocumentGroupRow
              key={group.id}
              group={group}
              complete={complete}
              files={files}
              uploadedCount={uploadedCount}
              busy={groupBusy}
              readOnly={readOnly}
              uploadsEnabled={uploadsEnabled}
              mode={mode}
              inputId={`${baseId}-${group.id}`.replace(/:/g, "")}
              onRemoveSlot={
                mode === "draft" && onPendingBySlotChange
                  ? (slot) => onPendingBySlotChange(removePendingSlot(pendingBySlot ?? {}, slot))
                  : undefined
              }
              onFiles={(files) => {
                if (mode === "draft") {
                  if (isMulti) {
                    onPendingBySlotChange?.(assignPendingGroupFiles(group.id, files, pendingBySlot ?? {}));
                  } else {
                    const file = files[0];
                    if (file) onPendingBySlotChange?.({ ...(pendingBySlot ?? {}), ID: file });
                  }
                  return;
                }
                if (isMulti) void uploadMultiple(group.id, files);
                else {
                  const file = files[0];
                  if (file) void uploadFile("ID", file);
                }
              }}
              onView={
                mode === "owner" && bySlot.get("ID")
                  ? () => void openDocument(bySlot.get("ID")!)
                  : undefined
              }
            />
          );
        })}
      </ul>
    </section>
  );
}
