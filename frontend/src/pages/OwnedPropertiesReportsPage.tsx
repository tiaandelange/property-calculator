import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  ProplyticTable,
  ProplyticTableBody,
  ProplyticTableCell,
  ProplyticTableEmptyState,
  ProplyticTableHeadCell,
  ProplyticTableHeader,
  ProplyticTableRow,
  ProplyticTableSkeleton,
  ProplyticTableWrap,
  ProplyticTableRowActionsMenu
} from "../components/tables";
import { AppListPage } from "../components/ui/AppPage";
import { Card } from "../components/ui/Card";
import { Button, ButtonLink } from "../components/ui/Button";
import { AppConfirmDialog } from "../components/ui/AppModal";
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
    <>
      <AppListPage>
        <Helmet><title>Owned Properties Reports | The Property Guy</title></Helmet>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div className="pg-muted">
                Property reports generated from the Properties workspace.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <ButtonLink href="/owned-properties/reports" variant="ghost">Generate Portfolio Report</ButtonLink>
                <ButtonLink href="/dashboard" variant="ghost">My Reports</ButtonLink>
                <Button variant="soft" type="button" onClick={() => void load()} disabled={loading}>
                  Refresh
                </Button>
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
                      <ProplyticTableHeadCell actions />
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
                            <ProplyticTableRowActionsMenu
                              actions={[
                                {
                                  key: "download",
                                  label: "View or download report",
                                  icon: "edit",
                                  disabled: !r.storageBucket || !r.storageKey,
                                  onClick: async () => {
                                    const url = await getStoredReportSignedUrl(r);
                                    if (!url) throw new Error("This report has no stored PDF.");
                                    window.open(url, "_blank", "noopener,noreferrer");
                                  },
                                  primary: true
                                },
                                {
                                  key: "delete",
                                  label: "Delete report",
                                  icon: "delete",
                                  onClick: () => setPendingDelete(r),
                                  destructive: true
                                }
                              ]}
                            />
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
      </AppListPage>

      <AppConfirmDialog
          open={pendingDelete != null}
          title="Delete report"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          destructive
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            if (!pendingDelete) return;
            const row = pendingDelete;
            setPendingDelete(null);
            void (async () => {
              try {
                await deleteStoredReport(row.id);
                await load();
              } catch (e: any) {
                setError(e?.message ?? "Failed to delete report.");
              }
            })();
          }}
          consequence="This removes the PDF from Storage and deletes the report record."
        >
          <p style={{ margin: 0 }}>
            Delete this report for <strong>{pendingDelete?.propertyName}</strong>?
          </p>
      </AppConfirmDialog>
    </>
  );
}

