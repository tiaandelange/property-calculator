import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import {
  APPLICANT_DOCUMENT_SLOTS,
  applicantDocumentsCompleteCount
} from "../../applicants/applicantDocumentSlots";
import type { TenantDocumentRecord } from "../../../services/tenantDocumentsSupabase";
import { getTenantDocumentSignedUrl, listTenantDocumentsOwner } from "../../../services/tenantDocumentsSupabase";

export function TenantDocumentsCard({
  tenantId,
  loading: parentLoading
}: {
  tenantId: string | undefined;
  loading?: boolean;
}) {
  const [docs, setDocs] = useState<TenantDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!tenantId) {
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
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const bySlot = useMemo(() => new Map(docs.map((d) => [d.documentSlot, d])), [docs]);
  const uploadedCount = applicantDocumentsCompleteCount(new Set(Array.from(bySlot.keys())));

  const openDocument = async (doc: TenantDocumentRecord) => {
    try {
      const url = await getTenantDocumentSignedUrl(doc);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not open document.");
    }
  };

  if (parentLoading || loading) {
    return <div className="pg-tstmt-documents-card pg-workspace-card pg-tstmt-skeleton" aria-busy="true" />;
  }

  if (!uploadedCount) {
    return (
      <section className="pg-tstmt-documents-card pg-workspace-card">
        <h2 className="pg-tstmt-documents-card__title">Documents</h2>
        <p className="pg-muted" style={{ margin: 0 }}>
          No supporting documents uploaded yet.
        </p>
      </section>
    );
  }

  return (
    <section className="pg-tstmt-documents-card pg-workspace-card">
      <div className="pg-tstmt-documents-card__head">
        <div>
          <h2 className="pg-tstmt-documents-card__title">Documents</h2>
          <p className="pg-muted pg-tstmt-documents-card__desc">
            Vetting documents from the applicant submission ({uploadedCount} of {APPLICANT_DOCUMENT_SLOTS.length}).
          </p>
        </div>
      </div>
      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
      <ul className="pg-tstmt-documents-list">
        {APPLICANT_DOCUMENT_SLOTS.filter((slot) => bySlot.has(slot.slot)).map((slotDef) => {
          const doc = bySlot.get(slotDef.slot)!;
          return (
            <li key={slotDef.slot} className="pg-tstmt-documents-list__item">
              <div>
                <div className="pg-tstmt-documents-list__label">{slotDef.label}</div>
                <div className="pg-muted pg-tstmt-documents-list__file">{doc.originalFilename || doc.fileName}</div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => void openDocument(doc)}>
                <ExternalLink size={14} aria-hidden style={{ marginRight: 4 }} />
                View
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
