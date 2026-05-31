import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Circle, ExternalLink, Upload } from "lucide-react";
import { Button } from "../../components/ui/Button";
import {
  APPLICANT_DOCUMENT_GROUPS,
  applicantDocumentFilenamesForGroup,
  applicantDocumentGroupComplete,
  applicantDocumentGroupsCompleteCount,
  applicantDocumentSlotIdsForGroup,
  type ApplicantDocumentSlotDef,
  type ApplicantDocumentSlotId
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
  variant = "outline",
  onFiles
}: {
  inputId: string;
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  variant?: "outline" | "soft";
  onFiles: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="pg-applicant-doc-upload-btn">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={FILE_ACCEPT}
        multiple={multiple}
        tabIndex={-1}
        aria-hidden
        className="pg-applicant-doc-slot__input"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={14} aria-hidden style={{ marginRight: 4 }} />
        {busy ? "Uploading…" : label}
      </Button>
    </div>
  );
}

function DocumentGroupRow({
  group,
  bySlot,
  busy,
  readOnly,
  uploadsEnabled,
  mode,
  inputId,
  onUploadSingle,
  onUploadMultiple,
  onView
}: {
  group: (typeof APPLICANT_DOCUMENT_GROUPS)[number];
  bySlot: Map<ApplicantDocumentSlotId, TenantDocumentRecord>;
  busy?: boolean;
  readOnly?: boolean;
  uploadsEnabled: boolean;
  mode: "public" | "owner";
  inputId: string;
  onUploadSingle: (file: File) => void;
  onUploadMultiple: (files: FileList) => void;
  onView?: (doc: TenantDocumentRecord) => void;
}) {
  const isMulti = group.id === "payslips" || group.id === "bank";
  const uploadedSlots = new Set(Array.from(bySlot.keys()));
  const complete = applicantDocumentGroupComplete(group.id, uploadedSlots);
  const filenames = applicantDocumentFilenamesForGroup(group.id, bySlot);
  const uploadedCount = applicantDocumentSlotIdsForGroup(group.id).filter((slot) => bySlot.has(slot)).length;

  return (
    <li className="pg-applicant-doc-slot">
      <SlotIndicator uploaded={complete} busy={busy} />
      <div className="pg-applicant-doc-slot__copy">
        <div className="pg-applicant-doc-slot__label">{group.title}</div>
        <p className="pg-muted pg-applicant-documents__group-desc">{group.description}</p>
        <div className="pg-applicant-doc-slot__file pg-muted">{filenames || "Not uploaded yet"}</div>
      </div>
      <div className="pg-applicant-doc-slot__actions">
        {mode === "owner" && group.id === "identity" && bySlot.get("ID") ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onView?.(bySlot.get("ID")!)}>
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
                  : "Upload files"
                : complete
                  ? "Replace"
                  : "Upload file"
            }
            multiple={isMulti}
            disabled={!uploadsEnabled}
            busy={busy}
            variant={complete ? "soft" : "outline"}
            onFiles={(files) => {
              if (isMulti) onUploadMultiple(files);
              else {
                const file = files[0];
                if (file) onUploadSingle(file);
              }
            }}
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
  readOnly
}: {
  mode: "public" | "owner";
  tenantId: string | null;
  inviteToken?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const baseId = useId();
  const [docs, setDocs] = useState<TenantDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busySlot, setBusySlot] = useState<ApplicantDocumentSlotId | null>(null);
  const [busyGroup, setBusyGroup] = useState<ApplicantDocumentSlotDef["group"] | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) {
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
  const groupsCompleteCount = applicantDocumentGroupsCompleteCount(uploadedSlots);

  const uploadFileCore = async (slot: ApplicantDocumentSlotId, file: File) => {
    if (!tenantId || disabled || readOnly) return;
    if (mode === "public") {
      if (!inviteToken) throw new Error("Missing application link token.");
      await uploadApplicantDocumentPublic(inviteToken, tenantId, slot, file);
    } else {
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

  const uploadsEnabled = Boolean(tenantId) && !disabled && !readOnly;

  return (
    <section className="pg-applicant-documents" aria-labelledby="applicant-documents-title">
      <div className="pg-applicant-documents__head">
        <div>
          <h2 id="applicant-documents-title" className="pg-applicant-documents__title">
            Supporting documents
          </h2>
          <p className="pg-muted pg-applicant-documents__desc">
            Upload your ID, three recent payslips, and three recent bank statements. Each category shows a green check
            when complete. Select up to three payslips or bank statements at once.
          </p>
        </div>
        <span className="pg-applicant-documents__progress" aria-live="polite">
          {groupsCompleteCount} of {APPLICANT_DOCUMENT_GROUPS.length} complete
        </span>
      </div>

      {!tenantId ? (
        <p className="pg-muted pg-applicant-documents__hint">
          Save your application details above to unlock document uploads.
        </p>
      ) : null}

      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
      {loading && !docs.length ? <p className="pg-muted">Loading documents…</p> : null}

      <ul className="pg-applicant-documents__slots">
        {APPLICANT_DOCUMENT_GROUPS.map((group) => {
          const groupBusy = busyGroup === group.id || (group.id === "identity" && busySlot === "ID");

          return (
            <DocumentGroupRow
              key={group.id}
              group={group}
              bySlot={bySlot}
              busy={groupBusy}
              readOnly={readOnly}
              uploadsEnabled={uploadsEnabled}
              mode={mode}
              inputId={`${baseId}-${group.id}`}
              onUploadSingle={(file) => void uploadFile("ID", file)}
              onUploadMultiple={(files) => void uploadMultiple(group.id, files)}
              onView={(doc) => void openDocument(doc)}
            />
          );
        })}
      </ul>
    </section>
  );
}
