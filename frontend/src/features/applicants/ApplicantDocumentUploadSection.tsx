import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, ExternalLink, Upload } from "lucide-react";
import { Button } from "../../components/ui/Button";
import {
  APPLICANT_DOCUMENT_GROUPS,
  applicantDocumentSlotsForGroup,
  applicantDocumentsCompleteCount,
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
  const [docs, setDocs] = useState<TenantDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busySlot, setBusySlot] = useState<ApplicantDocumentSlotId | null>(null);
  const inputRefs = useRef<Partial<Record<ApplicantDocumentSlotId, HTMLInputElement>>>({});

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

  const uploadFile = async (slot: ApplicantDocumentSlotId, file: File) => {
    if (!tenantId || disabled || readOnly) return;
    setBusySlot(slot);
    setError("");
    try {
      if (mode === "public") {
        if (!inviteToken) throw new Error("Missing application link token.");
        await uploadApplicantDocumentPublic(inviteToken, tenantId, slot, file);
      } else {
        await uploadTenantDocumentOwner(tenantId, slot, file);
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusySlot(null);
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
            uploaded.
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

      {APPLICANT_DOCUMENT_GROUPS.map((group) => (
        <div key={group.id} className="pg-applicant-documents__group">
          <h3 className="pg-applicant-documents__group-title">{group.title}</h3>
          <p className="pg-muted pg-applicant-documents__group-desc">{group.description}</p>
          <ul className="pg-applicant-documents__slots">
            {applicantDocumentSlotsForGroup(group.id).map((slotDef) => {
              const doc = bySlot.get(slotDef.slot);
              const uploaded = Boolean(doc?.storageKey || doc?.uploadedAt);
              const busy = busySlot === slotDef.slot;
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
                      <>
                        <input
                          ref={(el) => {
                            inputRefs.current[slotDef.slot] = el ?? undefined;
                          }}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png"
                          className="pg-applicant-doc-slot__input"
                          aria-label={`Upload ${slotDef.label}`}
                          disabled={!uploadsEnabled || busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadFile(slotDef.slot, file);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          variant={uploaded ? "soft" : "outline"}
                          size="sm"
                          disabled={!uploadsEnabled || busy}
                          onClick={() => inputRefs.current[slotDef.slot]?.click()}
                        >
                          <Upload size={14} aria-hidden style={{ marginRight: 4 }} />
                          {uploaded ? "Replace" : "Upload"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
