import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { fetchPdfBlob, triggerPdfFileDownload } from "../api/pdfBlob";
import { deleteUserReport, listUserReports } from "../services/profileSupabase";
import { generateReportViaVercel } from "../services/reportsVercel";
import { Card } from "../components/ui/Card";
import { AppListPage, AppPageActions, AppPageHeader, AppPageSubtitle, AppPageTitle } from "../components/ui/AppPage";
import { Grid } from "../components/ui/Grid";
import { Button, ButtonLink } from "../components/ui/Button";
import { AppModal } from "../components/ui/AppModal";
import { useWorkspaceId } from "../features/queries";
import { queryKeys } from "../lib/queryKeys";
import { formatReportLimitUsage } from "../lib/subscription/planFeatures";
import { UpgradePrompt } from "../lib/subscription/UpgradePrompt";
import { usePlanPermissions } from "../lib/subscription/usePlanPermissions";

type Report = {
  id: string | number;
  type: string;
  created_at: string;
  hasPdf: boolean;
  legacyPdfOnly?: boolean;
  reportId?: string | number | null;
  downloadUrl: string | null;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
};

function getKeyMetric(result: Record<string, unknown>) {
  const first = Object.entries(result).find(([, v]) => typeof v === "number") as [string, number] | undefined;
  if (!first) return null;
  const [k, v] = first;
  const pretty = typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v);
  return { label: k, value: pretty };
}

export function DashboardPage() {
  const permissions = usePlanPermissions();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [showReportUpgrade, setShowReportUpgrade] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [pdfBusyCalcId, setPdfBusyCalcId] = useState<string | number | null>(null);
  const [pdfDownloadBusyKey, setPdfDownloadBusyKey] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const invalidateUsage = useCallback(async () => {
    if (!workspaceId) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.subscription(workspaceId) });
  }, [queryClient, workspaceId]);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError("");
    try {
      const rows = await listUserReports();
      if (seq !== loadSeq.current) return;
      setReports(rows);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load reports. Are you logged in?");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async (calculationId: string | number) => {
    if (!permissions.canGenerateReport && permissions.limitsActive) {
      setShowReportUpgrade(true);
      return;
    }
    setError("");
    setPdfBusyCalcId(calculationId);
    try {
      await generateReportViaVercel({ reportType: "CALCULATION", calculationId: String(calculationId) });
      await Promise.all([load(), invalidateUsage()]);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to generate report.");
    } finally {
      setPdfBusyCalcId(null);
    }
  };

  const downloadSavedReport = async (r: Report) => {
    if (!r.downloadUrl) return;
    const key = `${r.reportId ?? r.id}`;
    setPdfDownloadBusyKey(key);
    setError("");
    try {
      const blob = await fetchPdfBlob(r.downloadUrl);
      triggerPdfFileDownload(blob, `report-${r.type}-${r.reportId ?? r.id}.pdf`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to download PDF.");
    } finally {
      setPdfDownloadBusyKey(null);
    }
  };

  const del = async (id: string | number) => {
    setError("");
    try {
      await deleteUserReport(String(id));
      await Promise.all([load(), invalidateUsage()]);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to delete report.");
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, []);

  return (
    <AppListPage>
      <Helmet>
        <title>My Reports | The Property Guy</title>
        <meta name="description" content="View, generate and download your saved property calculation reports." />
      </Helmet>
      <AppPageHeader>
        <div>
          <AppPageTitle>{greeting}</AppPageTitle>
          <AppPageSubtitle>Your saved calculations and PDF reports live here.</AppPageSubtitle>
          {permissions.limitsActive ? (
            <p className="pg-plan-limit-hint" style={{ marginTop: 8 }}>
              {formatReportLimitUsage(
                permissions.usage.investmentReportCount,
                permissions.getLimit("maxReportsPerMonth"),
                permissions.reportPeriodLabel
              )}
            </p>
          ) : null}
        </div>
        <AppPageActions>
          <Button onClick={load} loading={loading}>
            Refresh
          </Button>
          <ButtonLink href="/calculators/cash-on-cash-return" variant="soft">
            New calculation
          </ButtonLink>
        </AppPageActions>
      </AppPageHeader>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 16 }}>{error}</div> : null}

        <div style={{ height: 16 }} />

        {reports.length === 0 && !loading ? (
          <Card>
            <h2 className="pg-h2" style={{ marginTop: 0 }}>
              No reports yet
            </h2>
            <p className="pg-lead">
              Run a calculator while logged in and your results will show up here automatically.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ButtonLink href="/calculators/noi" variant="primary">
                Start with NOI
              </ButtonLink>
              <ButtonLink href="/calculators/cash-flow" variant="ghost">
                Explore cash flow
              </ButtonLink>
            </div>
          </Card>
        ) : null}

        {reports.length > 0 ? (
          <Grid cols={3}>
            {reports.map((r) => {
              const metric = getKeyMetric(r.result);
              return (
                <Card key={r.id}>
                  <div className="pg-workspace-inset-list">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 900 }}>{r.type}</div>
                      <div className="pg-muted" style={{ fontSize: 12 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>

                    {metric ? (
                      <div className="pg-kpi">
                        <div className="pg-kpi-value">{metric.value}</div>
                        <div className="pg-kpi-label">{metric.label}</div>
                      </div>
                    ) : (
                      <div className="pg-muted">No numeric key metric detected.</div>
                    )}

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <ButtonLink href={`/calculators/${r.type}`} variant="ghost">
                        View
                      </ButtonLink>
                      {r.downloadUrl ? (
                        <Button
                          variant="secondary"
                          loading={pdfDownloadBusyKey === `${r.reportId ?? r.id}`}
                          onClick={() => void downloadSavedReport(r)}
                        >
                          Download PDF
                        </Button>
                      ) : !permissions.canGenerateReport && permissions.limitsActive ? (
                        <Button variant="secondary" type="button" onClick={() => setShowReportUpgrade(true)}>
                          Generate PDF
                        </Button>
                      ) : (
                        <Button variant="secondary" loading={pdfBusyCalcId === r.id} onClick={() => void generate(r.id)}>
                          {r.legacyPdfOnly ? "Regenerate PDF" : "Generate PDF"}
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => del(r.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </Grid>
        ) : null}

        <AppModal
          open={showReportUpgrade}
          onOpenChange={setShowReportUpgrade}
          title="Report limit reached"
          description="Upgrade your plan to generate more reports this month."
          footer={
            <Button variant="secondary" type="button" onClick={() => setShowReportUpgrade(false)}>
              Close
            </Button>
          }
        >
          <UpgradePrompt context="report" limit="maxReportsPerMonth" />
        </AppModal>
    </AppListPage>
  );
}

