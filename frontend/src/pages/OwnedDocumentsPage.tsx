import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { api, authHeader } from "../api/client";
import { getProperties } from "../api/ownedProperties";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { usePropertyWorkspaceRefresh } from "../features/properties/usePropertyWorkspaceRefresh";
import { resolveApiOrigin } from "../lib/apiBase";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import {
  deletePropertyDocument,
  getSignedDocumentUrl,
  listPropertyDocuments,
  uploadPropertyDocument
} from "../services/documentsSupabase";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { PageBreadcrumb } from "../components/nav/PageBreadcrumb";
import { workspacePage } from "../nav/workspaceBreadcrumbs";

export function OwnedDocumentsPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("LEASE_AGREEMENT");
  const [error, setError] = useState("");

  async function loadProperties() {
    const rows = await getProperties();
    setProperties(rows);
    if (!propertyId && rows[0]) setPropertyId(String(rows[0].id));
  }

  async function loadDocs(pid: string) {
    if (isSupabaseConfigured) {
      const docs = await listPropertyDocuments(String(pid));
      setDocuments(docs);
    } else {
      const res = await api.get(`/properties/${pid}/documents`, { headers: authHeader() });
      setDocuments(res.data);
    }
  }

  useEffect(() => {
    void loadProperties();
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    void loadDocs(propertyId);
  }, [propertyId]);

  usePropertyWorkspaceRefresh({
    propertyId: propertyId || undefined,
    onRefresh: () => {
      void loadProperties();
      if (propertyId) void loadDocs(propertyId);
    }
  });

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!propertyId || !file) return;
    try {
      if (isSupabaseConfigured) {
        await uploadPropertyDocument(propertyId, file, { documentType });
      } else {
        const form = new FormData();
        form.append("file", file);
        form.append("documentType", documentType);
        await api.post(`/properties/${propertyId}/documents/upload`, form, {
          headers: { ...authHeader(), "Content-Type": "multipart/form-data" }
        });
      }
      setFile(null);
      await loadDocs(propertyId);
      invalidatePropertyWorkspace(propertyId);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Upload failed");
    }
  };

  const remove = async (id: string | number) => {
    try {
      if (isSupabaseConfigured) {
        await deletePropertyDocument(String(id));
      } else {
        await api.delete(`/documents/${id}`, { headers: authHeader() });
      }
      if (propertyId) {
        await loadDocs(propertyId);
        invalidatePropertyWorkspace(propertyId);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Delete failed");
    }
  };

  /**
   * Express: signed URL on API host. Supabase: Storage signed URL (private bucket).
   */
  const downloadDocument = async (id: string | number) => {
    try {
      if (isSupabaseConfigured) {
        const { url } = await getSignedDocumentUrl(String(id));
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      const res = await api.post(`/documents/${id}/sign-download`, undefined, { headers: authHeader() });
      const url = res.data?.url as string | undefined;
      if (!url) throw new Error("Could not get signed download URL.");
      const baseHost = resolveApiOrigin();
      window.open(`${baseHost}${url}`, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Download failed");
    }
  };

  return (
    <Section>
      <Helmet>
        <title>Documents | The Property Guy</title>
      </Helmet>
      <Container>
        <PageBreadcrumb items={workspacePage("Documents")} />
        <h1 className="pg-h2">Documents</h1>
        {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
        <Card>
          <Field label="Property">
            <select
              className="pg-input"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {properties.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <form onSubmit={upload}>
            <Field label="Document type">
              <select className="pg-input" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                {["LEASE_AGREEMENT", "ID_DOCUMENT", "PROOF_OF_PAYMENT", "MUNICIPAL_ACCOUNT", "INSURANCE", "INSPECTION", "OTHER"].map(
                  (d) => (
                    <option key={d}>
                      {d}
                    </option>
                  )
                )}
              </select>
            </Field>
            <Field label="Upload file (PDF, DOC/DOCX, JPG/PNG, max 10MB)">
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            <Button type="submit">Upload</Button>
          </form>
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Documents">
          <div style={{ display: "grid", gap: 8 }}>
            {documents.map((d) => (
              <div key={String(d.id)} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <span>
                  {d.fileName} ({d.documentType})
                </span>
                <span style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => void downloadDocument(d.id)}>
                    Download
                  </Button>
                  <Button variant="ghost" onClick={() => void remove(d.id)}>
                    Delete
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </Container>
    </Section>
  );
}
