import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { IconButton } from "../components/icons";
import {
  ProplyticMobileRowCard,
  ProplyticMobileRowList,
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
import { useMediaQuery } from "../hooks/useMediaQuery";
import { deleteStoredReport, getStoredReportSignedUrl, listPropertyStoredReports, type PropertyStoredReportRow } from "../services/storedReportsSupabase";
import { deleteInvestmentReport, getInvestmentReportSignedUrl, listInvestmentReports, type InvestmentReportRow } from "../services/investmentReportsSupabase";

export function OwnedPropertiesReportsPage() {
  const [rows, setRows] = useState<PropertyStoredReportRow[]>([]);
  const [investmentRows, setInvestmentRows] = useState<InvestmentReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PropertyStoredReportRow | null>(null);
  const [pendingInvDelete, setPendingInvDelete] = useState<InvestmentReportRow | null>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError("");
    try {
      const [propertyRows, investmentList] = await Promise.all([
        listPropertyStoredReports(),
        listInvestmentReports().catch((e: unknown) => {
          const msg = String(e instanceof Error ? e.message : e);
          if (msg.includes("Could not find the table") && msg.includes("investment_reports")) {
            return [] as InvestmentReportRow[];
          }
          throw e;
        })
      ]);
      if (seq !== loadSeq.current) return;
      setRows(propertyRows);
      setInvestmentRows(investmentList);
    } catch (e: unknown) {
      if (seq !== loadSeq.current) return;
      setError(e instanceof Error ? e.message : "Failed to load reports.");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const removePropertyRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const removeInvestmentRow = (id: string) => {
    setInvestmentRows((prev) => prev.filter((r) => r.id !== id));
  };

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

          <section className="pg-tenants-list-panel pg-workspace-card" aria-busy={loading} style={{ marginBottom: 14 }}>
            <div className="pg-card-title" style={{ marginBottom: 10 }}>
              Investment Reports
            </div>
            {loading ? (
              <ProplyticTableSkeleton rows={3} />
            ) : investmentRows.length ? (
                isMobile ? (
                  <ProplyticMobileRowList>
                    {investmentRows.map((r) => {
                      const dt = r.createdAt ? new Date(r.createdAt) : null;
                      const when = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : r.createdAt || "—";
                      return (
                        <li key={r.id}>
                          <ProplyticMobileRowCard
                            title={r.fileName}
                            subtitle={r.label || r.propertyType.replace(/-/g, " ")}
                            badge={<span className="pg-muted" style={{ fontSize: 12 }}>{when}</span>}
                            fields={[
                              { label: "Type", value: r.propertyType },
                              { label: "Report ID", value: r.id }
                            ]}
                            actions={
                              <>
                                <IconButton
                                  icon="open"
                                  aria-label="View or download investment report"
                                  variant="outline"
                                  onClick={async () => {
                                    const url = await getInvestmentReportSignedUrl(r);
                                    if (!url) throw new Error("This report has no stored PDF.");
                                    window.open(url, "_blank", "noopener,noreferrer");
                                  }}
                                />
                                <IconButton
                                  icon="delete"
                                  aria-label="Delete investment report"
                                  variant="danger"
                                  onClick={() => setPendingInvDelete(r)}
                                />
                              </>
                            }
                          />
                        </li>
                      );
                    })}
                  </ProplyticMobileRowList>
                ) : (
                  <ProplyticTableWrap responsive>
                    <ProplyticTable>
                      <ProplyticTableHeader>
                        <ProplyticTableRow>
                          <ProplyticTableHeadCell columnType="date">Generated</ProplyticTableHeadCell>
                          <ProplyticTableHeadCell columnType="text">Type</ProplyticTableHeadCell>
                          <ProplyticTableHeadCell columnType="text">File</ProplyticTableHeadCell>
                          <ProplyticTableHeadCell columnType="actions" />
                        </ProplyticTableRow>
                      </ProplyticTableHeader>
                      <ProplyticTableBody>
                        {investmentRows.map((r) => {
                          const dt = r.createdAt ? new Date(r.createdAt) : null;
                          const when = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : r.createdAt || "—";
                          return (
                            <ProplyticTableRow key={r.id}>
                              <ProplyticTableCell columnType="date">
                                <div style={{ fontWeight: 700 }}>{when}</div>
                                <div className="pg-tenants-sub">{r.id}</div>
                              </ProplyticTableCell>
                              <ProplyticTableCell columnType="text">
                                <strong>{r.label || r.propertyType.replace(/-/g, " ")}</strong>
                                <div className="pg-tenants-sub">{r.propertyType}</div>
                              </ProplyticTableCell>
                              <ProplyticTableCell columnType="text">
                                <div style={{ fontWeight: 700 }}>{r.fileName}</div>
                                <div className="pg-tenants-sub">{r.storageBucket}</div>
                              </ProplyticTableCell>
                              <ProplyticTableCell columnType="actions">
                                <ProplyticTableRowActionsMenu
                                  actions={[
                                    {
                                      key: "download",
                                      label: "View or download report",
                                      icon: "open",
                                      onClick: async () => {
                                        const url = await getInvestmentReportSignedUrl(r);
                                        if (!url) throw new Error("This report has no stored PDF.");
                                        window.open(url, "_blank", "noopener,noreferrer");
                                      },
                                      primary: true
                                    },
                                    {
                                      key: "delete",
                                      label: "Delete report",
                                      icon: "delete",
                                      onClick: () => setPendingInvDelete(r),
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
                )
              ) : (
                <ProplyticTableEmptyState
                  title="No investment reports generated yet"
                  description="Generate an investment report from the Calculators page to see them here."
                />
              )}
          </section>

          <section className="pg-tenants-list-panel pg-workspace-card" aria-busy={loading}>
            <div className="pg-card-title" style={{ marginBottom: 10 }}>
              Property Reports
            </div>
            {loading ? (
              <ProplyticTableSkeleton rows={5} />
            ) : rows.length ? (
              isMobile ? (
                <ProplyticMobileRowList>
                  {rows.map((r) => {
                    const dt = r.createdAt ? new Date(r.createdAt) : null;
                    const when = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : r.createdAt || "—";
                    return (
                      <li key={r.id}>
                        <ProplyticMobileRowCard
                          title={r.fileName}
                          subtitle={r.propertyName || "Property"}
                          badge={<span className="pg-muted" style={{ fontSize: 12 }}>{when}</span>}
                          fields={[
                            { label: "Property ID", value: r.propertyId ?? "—" },
                            { label: "Report ID", value: r.id },
                            { label: "Storage", value: r.storageBucket ?? "—" }
                          ]}
                          actions={
                            <>
                              <IconButton
                                icon="open"
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
                            </>
                          }
                        />
                      </li>
                    );
                  })}
                </ProplyticMobileRowList>
              ) : (
              <ProplyticTableWrap responsive>
                <ProplyticTable>
                  <ProplyticTableHeader>
                    <ProplyticTableRow>
                      <ProplyticTableHeadCell columnType="date">Generated</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="text">Property</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="text">File</ProplyticTableHeadCell>
                      <ProplyticTableHeadCell columnType="actions" />
                    </ProplyticTableRow>
                  </ProplyticTableHeader>
                  <ProplyticTableBody>
                    {rows.map((r) => {
                      const dt = r.createdAt ? new Date(r.createdAt) : null;
                      const when = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : r.createdAt || "—";
                      return (
                        <ProplyticTableRow key={r.id}>
                          <ProplyticTableCell columnType="date">
                            <div style={{ fontWeight: 700 }}>{when}</div>
                            <div className="pg-tenants-sub">{r.id}</div>
                          </ProplyticTableCell>
                          <ProplyticTableCell columnType="text">
                            <strong>{r.propertyName || "Property"}</strong>
                            <div className="pg-tenants-sub">{r.propertyId ?? "—"}</div>
                          </ProplyticTableCell>
                          <ProplyticTableCell columnType="text">
                            <div style={{ fontWeight: 700 }}>{r.fileName}</div>
                            <div className="pg-tenants-sub">{r.storageBucket ?? "—"}</div>
                          </ProplyticTableCell>
                          <ProplyticTableCell columnType="actions">
                            <ProplyticTableRowActionsMenu
                              actions={[
                                {
                                  key: "download",
                                  label: "View or download report",
                                  icon: "open",
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
              )
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
            removePropertyRow(row.id);
            void (async () => {
              try {
                await deleteStoredReport(row.id);
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed to delete report.");
                await load();
              }
            })();
          }}
          consequence="This removes the PDF from Storage and deletes the report record."
        >
          <p style={{ margin: 0 }}>
            Delete this report for <strong>{pendingDelete?.propertyName}</strong>?
          </p>
      </AppConfirmDialog>

      <AppConfirmDialog
        open={pendingInvDelete != null}
        title="Delete investment report"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onClose={() => setPendingInvDelete(null)}
        onConfirm={() => {
          if (!pendingInvDelete) return;
          const row = pendingInvDelete;
          setPendingInvDelete(null);
          removeInvestmentRow(row.id);
          void (async () => {
            try {
              await deleteInvestmentReport(row.id);
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed to delete report.");
              await load();
            }
          })();
        }}
        consequence="This removes the PDF from Storage and deletes the report record."
      >
        <p style={{ margin: 0 }}>
          Delete this investment report <strong>{pendingInvDelete?.label || pendingInvDelete?.propertyType}</strong>?
        </p>
      </AppConfirmDialog>
    </>
  );
}
