import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { IconButton } from "../components/icons";
import {
  ProplyticTable,
  ProplyticTableActions,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableEmptyState,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableSkeleton,
  ProplyticTableWrap
} from "../components/tables";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ModalOverlay, ModalPanel } from "../components/ui/Modal";
import { deleteStoredReport, getStoredReportSignedUrl, listPropertyStoredReports, type PropertyStoredReportRow } from "../services/storedReportsSupabase";

export function OwnedPropertiesReportsPage() {
  const [rows, setRows] = useState<PropertyStoredReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PropertyStoredReportRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await listPropertyStoredReports());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Section>
      <Helmet><title>Owned Properties Reports | The Property Guy</title></Helmet>
      <Container>
        <div className="pg-workspace-page">
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div className="pg-muted">
                Property reports generated from the Properties workspace.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link className="pg-btn pg-btn-ghost" to="/owned-properties/reports">Generate Portfolio Report</Link>
                <Link className="pg-btn pg-btn-ghost" to="/dashboard">My Reports</Link>
                <button className="pg-btn pg-btn-secondary" type="button" onClick={() => void load()} disabled={loading}>
                  Refresh
                </button>
              </div>
            </div>
          </Card>

          {error ? (
            <div className="pg-alert pg-alert-error" role="alert">
              {error}
            </div>
          ) : null}

          <section className="pg-tenants-list-panel pg-workspace-card" aria-busy={loading}>
            {loading ? (
              <ProplyticTableSkeleton rows={5} />
            ) : rows.length ? (
              <ProplyticTableWrap responsive>
                <ProplyticTable style={{ minWidth: 860 }}>
                  <ProplyticTableHeader>
                    <ProplyticTableRow>
                      <ProplyticTableHeadCell>Generated</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell>Property</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell>File</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell actions>
                        <span className="pg-ptable-sr-only">Actions</span>
                      </ProplyticTableHeadCell>
                    </ProplyticTableRow>
                  </ProplyticTableHeader>
                  <ProplyticTableBody>
                    {rows.map((r) => {
                      const dt = r.createdAt ? new Date(r.createdAt) : null;
                      const when = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : r.createdAt || "—";
                      return (
                        <ProplyticTableRow key={r.id}>
                          <ProplyticTableCell>
                            <div style={{ fontWeight: 700 }}>{when}</div>
                            <div className="pg-tenants-sub">{r.id}</div>
                          </ProplyticTableCell>
                          <ProplyticTableCell>
                            <strong>{r.propertyName || "Property"}</strong>
                            <div className="pg-tenants-sub">{r.propertyId ?? "—"}</div>
                          </ProplyticTableCell>
                          <ProplyticTableCell>
                            <div style={{ fontWeight: 700 }}>{r.fileName}</div>
                            <div className="pg-tenants-sub">{r.storageBucket ?? "—"}</div>
                          </ProplyticTableCell>
                          <ProplyticTableCell actions>
                            <ProplyticTableActions>
                              <IconButton
                                icon="download"
                                aria-label="View or download report"
                                variant="outline"
                                disabled={!r.storageBucket || !r.storageKey}
                                onClick={async () => {
                                  const url = await getStoredReportSignedUrl(r);
                                  if (!url) throw new Error("This report has no stored PDF.");
                                  window.open(url, "_blank", "noopener,noreferrer");
                                }}
                              />
                              <IconButton
                                icon="delete"
                                aria-label="Delete report"
                                variant="danger"
                                onClick={() => setPendingDelete(r)}
                              />
                            </ProplyticTableActions>
                          </ProplyticTableCell>
                        </ProplyticTableRow>
                      );
                    })}
                  </ProplyticTableBody>
                </ProplyticTable>
              </ProplyticTableWrap>
            ) : (
              <ProplyticTableEmptyState
                title="No property reports generated yet"
                description="Generate reports from a property workspace to see them here."
              />
            )}
          </section>
        </div>

        {pendingDelete ? (
          <>
            <ModalOverlay open onClose={() => setPendingDelete(null)} />
            <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
              <ModalPanel title="Delete report" onClose={() => setPendingDelete(null)}>
                <div style={{ padding: 14, display: "grid", gap: 12 }}>
                  <div>
                    Delete this report for <strong>{pendingDelete.propertyName}</strong>?
                  </div>
                  <div className="pg-muted" style={{ fontSize: 13 }}>
                    This removes the PDF from Storage and deletes the report record.
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button className="pg-btn pg-btn-ghost" type="button" onClick={() => setPendingDelete(null)}>
                      Cancel
                    </button>
                    <button
                      className="pg-btn pg-btn-danger"
                      type="button"
                      onClick={async () => {
                        const id = pendingDelete.id;
                        setPendingDelete(null);
                        try {
                          await deleteStoredReport(id);
                          await load();
                        } catch (e: any) {
                          setError(e?.message ?? "Failed to delete report.");
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </ModalPanel>
            </div>
          </>
        ) : null}
      </Container>
    </Section>
  );
}

