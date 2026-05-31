import { useMemo } from "react";
import { Chart as ChartJS, ArcElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { MetricCard } from "../../../components/ui/DashboardKit";
import { WorkspaceTabs } from "../../../components/workspace/WorkspaceTabs";
import { asArray } from "../../../lib/asArray";
import { getChartCategoryPalette, getChartSemanticColors } from "../../../theme/cssTokens";
import { compositionSlicesFromSummary } from "../../financials/buildPropertyFinancialSummary";
import { usePropertyFinancialSummary } from "../../financials/usePropertyFinancialSummary";
import { PropertyOverviewHero } from "./PropertyOverviewHero";
import { PROPERTY_WORKSPACE_TABS } from "./propertyWorkspaceTabs";
import { formatOverviewCurrency, formatOverviewPercent } from "./propertyOverviewUtils";

ChartJS.register(ArcElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

type CompositionSlice = { label: string; amount: number; kind: "income" | "expense" };

function doughnutFromSlices(slices: CompositionSlice[]) {
  const labels = slices.map((s) => s.label);
  const data = slices.map((s) => s.amount);
  const semantic = getChartSemanticColors();
  const incomeColors = [semantic.success, semantic.info, semantic.primary, semantic.line];
  const expenseColors = getChartCategoryPalette();
  let incomeIdx = 0;
  let expenseIdx = 0;
  const backgroundColor = slices.map((s) => {
    if (s.kind === "income") {
      const c = incomeColors[incomeIdx % incomeColors.length];
      incomeIdx += 1;
      return c;
    }
    const c = expenseColors[Math.min(expenseIdx, expenseColors.length - 1)];
    expenseIdx += 1;
    return c;
  });
  return { labels, datasets: [{ data, backgroundColor, borderWidth: 1, borderColor: "rgba(0,0,0,.35)" }] };
}

type Props = {
  data: any;
  statement: any | null;
  perf: any | null;
  propertyId: string;
  navigate: (path: string) => void;
  currentLeases: any[];
  combinedContractRent: number;
  finSub: string;
  activeTab: string;
};

export function WorkspaceOverviewTab({
  data,
  statement,
  perf,
  propertyId,
  navigate,
  currentLeases,
  combinedContractRent,
  finSub,
  activeTab
}: Props) {
  const basePath = `/owned-properties/${propertyId}`;
  const { summary } = usePropertyFinancialSummary({
    propertyId,
    propertyDetail: data,
    currentLeases,
    statement
  });

  const recent = asArray(statement?.statementRows).slice(-8).reverse();
  const noiTrendRows = asArray(perf?.charts?.monthlyNOITrend);
  const alertMessages = asArray<string>(data.aggregateMeta?.alerts);
  const tenantRows = asArray(data.tenants);

  const incomeExpenseDoughnut = useMemo(() => {
    if (!summary) return null;
    const slices = compositionSlicesFromSummary(summary);
    return slices.length ? doughnutFromSlices(slices) : null;
  }, [summary]);

  const doughnutOptions = useMemo(
    () => ({
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            boxWidth: 12,
            font: { size: 11 },
            color: "rgba(255,255,255,.78)"
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx: { label?: string; raw?: unknown }) => {
              const raw = typeof ctx.raw === "number" ? ctx.raw : Number(ctx.raw);
              const v = Number.isFinite(raw) ? raw : 0;
              const lbl = ctx.label ?? "";
              return ` ${lbl}: R ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            }
          }
        }
      }
    }),
    []
  );

  const monthlyCashFlow = summary?.monthlyCashFlow ?? null;
  const cashFlowTone = monthlyCashFlow == null ? undefined : monthlyCashFlow >= 0 ? "success" : "danger";
  const cocPercent = summary?.cashOnCashRoi ?? null;

  return (
    <div className="pg-workspace-overview pg-prop-overview">
      <PropertyOverviewHero data={data} propertyId={propertyId} currentLeases={currentLeases} />

      <WorkspaceTabs
        className="pg-prop-overview__tabs"
        basePath={basePath}
        active={activeTab}
        tabs={[...PROPERTY_WORKSPACE_TABS]}
        extraQueryForTab={{ financials: `fin=${encodeURIComponent(finSub)}` }}
      />

      <div className="pg-prop-overview-metrics">
        <MetricCard
          title="Equity"
          value={summary?.equity == null ? "—" : formatOverviewCurrency(summary.equity)}
          subtitle="Market value less outstanding debt"
          iconPreset="portfolio-value"
          iconTone="primary"
        />
        <MetricCard
          title="Monthly Income"
          value={summary ? formatOverviewCurrency(summary.monthlyIncome) : "—"}
          subtitle={
            summary
              ? `Collected R ${summary.receivedThisMonth.toLocaleString()} · Expected R ${summary.expectedThisMonth.toLocaleString()}`
              : "Projected from active leases"
          }
          iconPreset="monthly-income"
          iconTone="success"
          onClick={() => navigate(`${basePath}?tab=financials&fin=statement`)}
          ariaLabel="Open financial statement"
        />
        <MetricCard
          title="Monthly Expenses"
          value={summary ? formatOverviewCurrency(summary.monthlyExpenses) : "—"}
          subtitle="Operating costs and debt service"
          iconPreset="expenses"
          iconTone="warning"
          onClick={() => navigate(`${basePath}?tab=financials&fin=statement`)}
          ariaLabel="Open financial statement"
        />
        <MetricCard
          title="Cash Flow"
          value={
            monthlyCashFlow == null ? (
              "—"
            ) : (
              <span style={{ color: monthlyCashFlow >= 0 ? "var(--success)" : "var(--danger)" }}>
                {formatOverviewCurrency(monthlyCashFlow)}
              </span>
            )
          }
          subtitle="Income after expenses"
          iconPreset="cash-flow"
          iconTone={cashFlowTone === "danger" ? "danger" : cashFlowTone === "success" ? "success" : "primary"}
        />
        <MetricCard
          title="Units Occupied"
          value={summary?.unitsOccupiedDisplay ?? "—"}
          subtitle="Occupied units"
          iconPreset="total-properties"
          iconTone="info"
          onClick={() => navigate(`${basePath}?tab=leases`)}
          ariaLabel="Open leases tab"
        />
        <MetricCard
          title="Cash on Cash ROI"
          value={cocPercent == null ? "—" : formatOverviewPercent(cocPercent, 2)}
          subtitle={cocPercent == null ? "Add investment details to calculate" : "Annualised return on cash invested"}
          iconPreset="yield"
          iconTone="warning"
        />
      </div>

      <div className="pg-prop-overview-sections">
        <div className="pg-prop-overview-charts">
          <Card title="Income vs expenses (projected · monthly)">
            {incomeExpenseDoughnut ? (
              <>
                <Doughnut data={incomeExpenseDoughnut} options={doughnutOptions} />
                <div className="pg-muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Same projected model as Property Financials — income from active leases; expenses from recurring charges and bond.
                </div>
              </>
            ) : (
              <div className="pg-muted">No composition data yet. Add leases or recurring expenses.</div>
            )}
          </Card>
          <Card title="NOI trend">
            {noiTrendRows.length ? (
              <Line
                data={{
                  labels: noiTrendRows.map((r: any) => r.label),
                  datasets: [
                    {
                      label: "NOI",
                      data: noiTrendRows.map((r: any) => r.noi),
                      borderColor: getChartSemanticColors().info,
                      backgroundColor: "rgba(77,150,255,0.15)"
                    }
                  ]
                }}
                options={{ plugins: { legend: { display: false } } }}
              />
            ) : (
              <div className="pg-muted">No trend yet.</div>
            )}
          </Card>
        </div>

        <div className="pg-prop-overview-snapshot-grid">
          <Card title="Tenants snapshot">
            {tenantRows.length === 0 ? (
              <div className="pg-muted">No tenants linked to this property.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {tenantRows.slice(0, 4).map((t: any) => (
                  <div key={t.id}>
                    <strong>
                      {t.firstName} {t.lastName}
                    </strong>
                    {t.email ? <div className="pg-muted" style={{ fontSize: 13 }}>{t.email}</div> : null}
                  </div>
                ))}
                {tenantRows.length > 4 ? <div className="pg-muted">+{tenantRows.length - 4} more</div> : null}
                <Button type="button" variant="ghost" onClick={() => navigate(`${basePath}?tab=tenants`)}>
                  Open tenants
                </Button>
              </div>
            )}
          </Card>

          <Card title="Lease status">
            {currentLeases.length === 0 ? (
              <div className="pg-muted">No current lease linked to this property.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  Contractual rent roll: <strong>R {combinedContractRent.toLocaleString()}</strong>/mo
                </div>
                <div className="pg-muted">{currentLeases.length} active lease</div>
                <Button type="button" variant="ghost" onClick={() => navigate(`${basePath}?tab=leases`)}>
                  Open leases
                </Button>
              </div>
            )}
          </Card>

          <Card title="Current invoice">
            {!statement?.currentInvoice ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div className="pg-muted">Create your first invoice for this property.</div>
                <Button type="button" variant="primary" onClick={() => navigate(`${basePath}?tab=financials&fin=invoice`)}>
                  Open invoice workspace
                </Button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  <strong>{statement.currentInvoice.invoiceNumber}</strong> ({statement.currentInvoice.status})
                </div>
                <div>Due: {statement.currentInvoice.dueDate ? new Date(statement.currentInvoice.dueDate).toLocaleDateString() : "—"}</div>
                <div>Total: R {Number(statement.currentInvoice.total ?? 0).toLocaleString()}</div>
                <Button type="button" variant="ghost" onClick={() => navigate(`${basePath}?tab=financials&fin=invoice`)}>
                  View in financials
                </Button>
              </div>
            )}
          </Card>

          <Card title="Recent activity">
            {recent.length === 0 ? (
              <div className="pg-muted">No transactions yet.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {recent.map((r: any) => (
                  <li key={r.id} style={{ marginBottom: 6 }}>
                    {r.date} — {r.description}{" "}
                    <span className="pg-muted">
                      {r.credit != null ? `+R ${r.credit}` : ""}
                      {r.debit != null ? ` −R ${r.debit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {alertMessages.length > 0 ? (
          <Card title="Alerts">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {alertMessages.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
