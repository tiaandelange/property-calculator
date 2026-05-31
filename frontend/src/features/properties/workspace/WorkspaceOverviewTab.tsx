import { useMemo } from "react";
import { Chart as ChartJS, ArcElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { AppSectionTabs } from "../../../components/ui/AppSectionTabs";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { MetricCard } from "../../../components/ui/DashboardKit";
import { asArray } from "../../../lib/asArray";
import { getChartCategoryPalette, getChartSemanticColors } from "../../../theme/cssTokens";
import { PropertyOverviewHero } from "./PropertyOverviewHero";
import {
  buildPropertyOverviewTabItems,
  resolvePropertyWorkspaceActiveTabId
} from "./propertyWorkspaceTabs";
import { formatOverviewCurrency, formatOverviewPercent, unitsOccupiedLabel } from "./propertyOverviewUtils";

ChartJS.register(ArcElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

type CompositionSlice = { label: string; amount: number; kind: "income" | "expense" };

function nz(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function slicesFromFinancialSummaryMonthly(fs: Record<string, unknown> | undefined): CompositionSlice[] | null {
  if (!fs) return null;
  const income: CompositionSlice[] = [];
  const rent = nz(fs.totalRentIncome);
  const otherInc = nz(fs.totalOtherIncome);
  if (rent > 0) income.push({ label: "Income · Rental & invoices", amount: rent, kind: "income" });
  if (otherInc > 0) income.push({ label: "Income · Other", amount: otherInc, kind: "income" });

  const expenseDefs: Array<{ label: string; val: number }> = [
    { label: "Rates & taxes", val: nz(fs.totalRatesTaxes) },
    { label: "Water", val: nz(fs.totalWater) },
    { label: "Electricity", val: nz(fs.totalElectricity) },
    { label: "Levies", val: nz(fs.totalLevies) },
    { label: "Insurance", val: nz(fs.totalInsurance) },
    { label: "Maintenance & repairs", val: nz(fs.totalMaintenance) },
    { label: "Bond / debt service", val: nz(fs.totalBondPayment) },
    { label: "Other expenses", val: nz(fs.totalOtherExpenses) }
  ];
  const expenses: CompositionSlice[] = expenseDefs
    .filter((e) => e.val > 0)
    .sort((a, b) => b.val - a.val)
    .map((e) => ({ label: `Expense · ${e.label}`, amount: e.val, kind: "expense" as const }));

  const all = [...income, ...expenses];
  return all.length ? all : null;
}

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
  const fs = data.financialSummary?.monthly;
  const basePath = `/owned-properties/${propertyId}`;

  const kNoi = perf?.kpis?.monthlyNOI;
  const kExp = perf?.kpis?.monthlyExpenses;
  const incomeMonth = Number(kNoi?.operatingIncomeProjectedFromLeases ?? 0);
  const operatingExpMonth = Number(kExp?.operatingExpenses ?? 0);
  const bondMonth = Number(kExp?.debtService ?? 0);
  const totalExpMonth = operatingExpMonth + bondMonth;
  const cashAfterDebt =
    Number.isFinite(incomeMonth) && Number.isFinite(operatingExpMonth) && Number.isFinite(bondMonth)
      ? incomeMonth - operatingExpMonth - bondMonth
      : null;

  const receivedMonth = Number(statement?.summary?.receivedThisMonth ?? 0);
  const expectedMonth = Number(statement?.summary?.expectedThisMonth ?? 0);

  const equity =
    data.currentEstimatedValue != null && data.outstandingBondBalance != null
      ? Number(data.currentEstimatedValue) - Number(data.outstandingBondBalance)
      : null;

  const rentalIncomeMonth = fs?.totalRentIncome ?? null;
  const expensesMonth = fs?.totalExpenses ?? null;
  const monthlyCashFlowForCoC =
    rentalIncomeMonth != null && expensesMonth != null ? rentalIncomeMonth - expensesMonth : null;
  const cashInvestedRaw = data.totalCashInvested;
  const cashInvested =
    cashInvestedRaw != null && cashInvestedRaw !== "" && !Number.isNaN(Number(cashInvestedRaw)) ? Number(cashInvestedRaw) : null;
  const cocPercent =
    cashInvested != null &&
    cashInvested > 0 &&
    monthlyCashFlowForCoC != null &&
    !Number.isNaN(monthlyCashFlowForCoC)
      ? (monthlyCashFlowForCoC * 12 * 100) / cashInvested
      : null;

  const recent = asArray(statement?.statementRows).slice(-8).reverse();
  const noiTrendRows = asArray(perf?.charts?.monthlyNOITrend);
  const alertMessages = asArray<string>(data.aggregateMeta?.alerts);
  const tenantRows = asArray(data.tenants);
  const unitsOccupied = unitsOccupiedLabel(data, currentLeases);

  const incomeExpenseDoughnut = useMemo(() => {
    const fromFs = slicesFromFinancialSummaryMonthly(fs as Record<string, unknown> | undefined);
    return fromFs ? doughnutFromSlices(fromFs) : null;
  }, [fs]);

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

  const cashFlowTone = cashAfterDebt == null ? undefined : cashAfterDebt >= 0 ? "success" : "danger";
  const tabItems = buildPropertyOverviewTabItems(basePath);
  const tabActiveId = resolvePropertyWorkspaceActiveTabId(activeTab, finSub);

  return (
    <div className="pg-workspace-overview pg-prop-overview">
      <PropertyOverviewHero
        data={data}
        propertyId={propertyId}
        currentLeases={currentLeases}
        monthlyIncome={incomeMonth}
      />

      <AppSectionTabs
        className="pg-prop-overview__tabs"
        ariaLabel="Property sections"
        activeId={tabActiveId}
        items={tabItems}
      />

      <div className="pg-prop-overview-metrics">
        <MetricCard
          title="Equity"
          value={equity == null ? "—" : formatOverviewCurrency(equity)}
          subtitle="Market value less outstanding debt"
          iconPreset="portfolio-value"
          iconTone="primary"
        />
        <MetricCard
          title="Monthly Income"
          value={formatOverviewCurrency(incomeMonth)}
          subtitle={`Collected R ${receivedMonth.toLocaleString()} · Expected R ${expectedMonth.toLocaleString()}`}
          iconPreset="monthly-income"
          iconTone="success"
          onClick={() => navigate(`${basePath}?tab=financials&fin=statement`)}
          ariaLabel="Open financial statement"
        />
        <MetricCard
          title="Monthly Expenses"
          value={formatOverviewCurrency(totalExpMonth)}
          subtitle="Current month outflows"
          iconPreset="expenses"
          iconTone="warning"
          onClick={() => navigate(`${basePath}?tab=financials&fin=statement`)}
          ariaLabel="Open financial statement"
        />
        <MetricCard
          title="Cash Flow"
          value={
            cashAfterDebt == null ? (
              "—"
            ) : (
              <span style={{ color: cashAfterDebt >= 0 ? "var(--success)" : "var(--danger)" }}>
                {formatOverviewCurrency(cashAfterDebt)}
              </span>
            )
          }
          subtitle="Income after expenses"
          iconPreset="cash-flow"
          iconTone={cashFlowTone === "danger" ? "danger" : cashFlowTone === "success" ? "success" : "primary"}
        />
        <MetricCard
          title="Units Occupied"
          value={unitsOccupied}
          subtitle="Occupied units"
          iconPreset="total-properties"
          iconTone="info"
          onClick={() => navigate(`${basePath}?tab=leases`)}
          ariaLabel="Open leases tab"
        />
        <MetricCard
          title="Cash on Cash ROI"
          value={cocPercent == null ? "—" : formatOverviewPercent(cocPercent)}
          subtitle={cocPercent == null ? "Add investment details to calculate" : "Annualised return"}
          iconPreset="yield"
          iconTone="warning"
        />
      </div>

      <div className="pg-prop-overview-sections">
        <div className="pg-prop-overview-charts">
          <Card title="Income vs expenses (this property · calendar month)">
            {incomeExpenseDoughnut ? (
              <>
                <Doughnut data={incomeExpenseDoughnut} options={doughnutOptions} />
                <div className="pg-muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Income in teal / blue tones; each expense category has its own shade.
                </div>
              </>
            ) : (
              <div className="pg-muted">No composition data for this period. Add income or expenses for the current month.</div>
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
