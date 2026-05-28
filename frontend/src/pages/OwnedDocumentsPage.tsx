import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { getProperties } from "../api/ownedProperties";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { usePropertyWorkspaceRefresh } from "../features/properties/usePropertyWorkspaceRefresh";
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
    const docs = await listPropertyDocuments(String(pid));
    setDocuments(docs);
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
      await uploadPropertyDocument(propertyId, file, { documentType });
      setFile(null);
      await loadDocs(propertyId);
      invalidatePropertyWorkspace(propertyId);
    } catch (err: any) {
      setError(err?.message ?? "Upload failed");
    }
  };

  const remove = async (id: string | number) => {
    try {
      await deletePropertyDocument(String(id));
      if (propertyId) {
        await loadDocs(propertyId);
        invalidatePropertyWorkspace(propertyId);
      }
    } catch (err: any) {
      setError(err?.message ?? "Delete failed");
    }
  };

  const downloadDocument = async (id: string | number) => {
    try {
      const { url } = await getSignedDocumentUrl(String(id));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setError(err?.message ?? "Download failed");
    }
  };

  return (
    <Section>
      <Helmet>
        <title>Documents | The Property Guy</title>
      </Helmet>
      <Container>
        <h1 className="pg-h2">Property documents</h1>
        {error ? (
          <div className="pg-alert pg-alert-error" role="alert">
            {error}
          </div>
        ) : null}
        <Card>
          <Field label="Property">
            <select
              className="pg-input"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <form onSubmit={upload}>
            <Field label="Document type">
              <select
                className="pg-input"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="LEASE_AGREEMENT">Lease agreement</option>
                <option value="ID_DOCUMENT">ID document</option>
                <option value="PROOF_OF_PAYMENT">Proof of payment</option>
                <option value="MUNICIPAL_ACCOUNT">Municipal account</option>
                <option value="INSURANCE">Insurance</option>
                <option value="INSPECTION">Inspection</option>
                <option value="REPORT">Report</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="File">
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </Field>
            <Button type="submit">Upload</Button>
          </form>
        </Card>
        <Card title="Uploaded files">
          <ul className="pg-workspace-inset-list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {documents.map((d) => (
              <li key={d.id} className="pg-workspace-inset" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span>
                  {d.originalFilename ?? d.fileName ?? d.id} ({d.documentType ?? "—"})
                </span>
                <Button type="button" variant="secondary" onClick={() => void downloadDocument(d.id)}>
                  Open
                </Button>
                <Button type="button" variant="ghost" onClick={() => void remove(d.id)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </Container>
    </Section>
  );
}
