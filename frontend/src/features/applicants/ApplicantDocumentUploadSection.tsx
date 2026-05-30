import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Check, Circle, ExternalLink, Upload } from "lucide-react";
import { buttonClassName } from "../../components/ui/buttonStyles";
import { Button } from "../../components/ui/Button";
import {
  APPLICANT_DOCUMENT_GROUPS,
  applicantDocumentSlotIdsForGroup,
  applicantDocumentSlotsForGroup,
  applicantDocumentsCompleteCount,
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

function DocumentSlotRow({
  slotDef,
  doc,
  busy,
  showView,
  onView
}: {
  slotDef: ApplicantDocumentSlotDef;
  doc?: TenantDocumentRecord;
  busy?: boolean;
  showView?: boolean;
  onView?: () => void;
}) {
  const uploaded = Boolean(doc?.storageKey || doc?.uploadedAt);
  return (
    <li className="pg-applicant-doc-slot pg-applicant-doc-slot--readonly">
      <SlotIndicator uploaded={uploaded} busy={busy} />
      <div className="pg-applicant-doc-slot__copy">
        <div className="pg-applicant-doc-slot__label">{slotDef.label}</div>
        {doc?.originalFilename || doc?.fileName ? (
          <div className="pg-applicant-doc-slot__file pg-muted">{doc.originalFilename || doc.fileName}</div>
        ) : (
          <div className="pg-applicant-doc-slot__file pg-muted">Not uploaded yet</div>
        )}
      </div>
      {showView && doc ? (
        <div className="pg-applicant-doc-slot__actions">
          <Button type="button" variant="ghost" size="sm" onClick={onView}>
            <ExternalLink size={14} aria-hidden style={{ marginRight: 4 }} />
            View
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function FileUploadLabel({
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
  return (
    <div className="pg-applicant-doc-upload-btn">
      <input
        id={inputId}
        type="file"
        accept={FILE_ACCEPT}
        multiple={multiple}
        className="pg-applicant-doc-slot__input"
        disabled={disabled || busy}
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        className={buttonClassName({
          variant,
          size: "sm",
          className: `pg-applicant-doc-upload-btn__label${disabled || busy ? " is-disabled" : ""}`
        })}
        aria-disabled={disabled || busy}
      >
        <Upload size={14} aria-hidden style={{ marginRight: 4 }} />
        {busy ? "Uploading…" : label}
      </label>
    </div>
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
  const uploadedCount = applicantDocumentsCompleteCount(new Set(Array.from(bySlot.keys())));

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
            Upload your ID, three recent payslips, and three recent bank statements. Each item shows a green check when
            uploaded. Payslips and bank statements can be selected together in one step (up to three files).
          </p>
        </div>
        <span className="pg-applicant-documents__progress" aria-live="polite">
          {uploadedCount} of 7 uploaded
        </span>
      </div>

      {!tenantId ? (
        <p className="pg-muted pg-applicant-documents__hint">Submit your application details first to unlock document uploads.</p>
      ) : null}

      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
      {loading && !docs.length ? <p className="pg-muted">Loading documents…</p> : null}

      {APPLICANT_DOCUMENT_GROUPS.map((group) => {
        const slots = applicantDocumentSlotsForGroup(group.id);
        const groupSlots = applicantDocumentSlotIdsForGroup(group.id);
        const groupUploaded = groupSlots.filter((s) => bySlot.has(s)).length;
        const groupBusy = busyGroup === group.id;
        const isMulti = group.id === "payslips" || group.id === "bank";

        return (
          <div key={group.id} className="pg-applicant-documents__group">
            <div className="pg-applicant-documents__group-head">
              <div>
                <h3 className="pg-applicant-documents__group-title">{group.title}</h3>
                <p className="pg-muted pg-applicant-documents__group-desc">{group.description}</p>
              </div>
              {!readOnly && isMulti ? (
                <FileUploadLabel
                  inputId={`${baseId}-${group.id}`}
                  label={groupUploaded > 0 ? "Replace files" : "Upload (up to 3)"}
                  multiple
                  disabled={!uploadsEnabled}
                  busy={groupBusy}
                  variant={groupUploaded > 0 ? "soft" : "outline"}
                  onFiles={(files) => void uploadMultiple(group.id, files)}
                />
              ) : null}
            </div>

            <ul className="pg-applicant-documents__slots">
              {slots.map((slotDef) => {
                const doc = bySlot.get(slotDef.slot);
                const busy = busySlot === slotDef.slot || groupBusy;

                if (group.id === "identity") {
                  const uploaded = Boolean(doc?.storageKey || doc?.uploadedAt);
                  return (
                    <li key={slotDef.slot} className="pg-applicant-doc-slot">
                      <SlotIndicator uploaded={uploaded} busy={busy} />
                      <div className="pg-applicant-doc-slot__copy">
                        <div className="pg-applicant-doc-slot__label">{slotDef.label}</div>
                        {doc?.originalFilename || doc?.fileName ? (
                          <div className="pg-applicant-doc-slot__file pg-muted">{doc.originalFilename || doc.fileName}</div>
                        ) : (
                          <div className="pg-applicant-doc-slot__file pg-muted">PDF or image, max 10 MB</div>
                        )}
                      </div>
                      <div className="pg-applicant-doc-slot__actions">
                        {mode === "owner" && doc ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => void openDocument(doc)}>
                            <ExternalLink size={14} aria-hidden style={{ marginRight: 4 }} />
                            View
                          </Button>
                        ) : null}
                        {!readOnly ? (
                          <FileUploadLabel
                            inputId={`${baseId}-${slotDef.slot}`}
                            label={uploaded ? "Replace" : "Upload"}
                            disabled={!uploadsEnabled}
                            busy={busy}
                            variant={uploaded ? "soft" : "outline"}
                            onFiles={(files) => {
                              const file = files[0];
                              if (file) void uploadFile(slotDef.slot, file);
                            }}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                }

                return (
                  <DocumentSlotRow
                    key={slotDef.slot}
                    slotDef={slotDef}
                    doc={doc}
                    busy={busy}
                    showView={mode === "owner"}
                    onView={doc ? () => void openDocument(doc) : undefined}
                  />
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
