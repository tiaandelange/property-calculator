import { useMemo } from "react";
import { Line, Doughnut } from "react-chartjs-2";
import { Card } from "../../../components/ui/Card";

/** Greens / teals — income */
const INCOME_SLICE_COLORS = ["#20C997", "#00C9A7", "#4D96FF", "#26C6DA"];

/** Reds → oranges by rank after sorting expenses descending (index 0 = largest). */
const EXPENSE_RANK_COLORS = [
  "#C62828",
  "#E53935",
  "#FF5722",
  "#FF6D00",
  "#FB8C00",
  "#FFA726",
  "#FFCA28",
  "#FFB74D",
  "#FFAB91",
  "#BCAAA4"
];

type CompositionSlice = { label: string; amount: number; kind: "income" | "expense" };

function nz(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Pie chart aligned with Overview tiles — uses same buckets as GET /properties/:id financialSummary.monthly */
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
  let incomeIdx = 0;
  let expenseIdx = 0;
  const backgroundColor = slices.map((s) => {
    if (s.kind === "income") {
      const c = INCOME_SLICE_COLORS[incomeIdx % INCOME_SLICE_COLORS.length];
      incomeIdx += 1;
      return c;
    }
    const c = EXPENSE_RANK_COLORS[Math.min(expenseIdx, EXPENSE_RANK_COLORS.length - 1)];
    expenseIdx += 1;
    return c;
  });
  return { labels, datasets: [{ data, backgroundColor, borderWidth: 1, borderColor: "rgba(0,0,0,.35)" }] };
}

const INV_LABEL: Record<string, string> = {
  LONG_TERM_RENTAL: "Long-term rental",
  SHORT_TERM_RENTAL: "Short-term rental",
  VACANT_LAND: "Vacant land",
  BRRRR: "BRRRR",
  FLIP: "Flip",
  PRIMARY_RESIDENCE: "Primary residence",
  COMMERCIAL: "Commercial",
  HOUSE_HACK: "House hack",
  MIXED_USE: "Mixed use",
  OTHER: "Other"
};

function occupancyHeading(inv: string | undefined, leases: any[]) {
  if (inv === "VACANT_LAND") return "Land — no tenant required";
  if (inv === "SHORT_TERM_RENTAL") return "Short-term rental";
  if (inv === "FLIP") return "Flip / renovation project";
  if (leases.length === 0) return "Vacant";
  const m2m = leases.some((l: any) => (l.displayStatus ?? l.status) === "MONTH_TO_MONTH");
  if (m2m) return "Occupied — month-to-month";
  return "Occupied";
}

type Props = {
  data: any;
  statement: any | null;
  perf: any | null;
  propertyId: string;
  navigate: (path: string) => void;
  currentLeases: any[];
  combinedContractRent: number;
};

export function WorkspaceOverviewTab({ data, statement, perf, propertyId, navigate, currentLeases, combinedContractRent }: Props) {
  const fs = data.financialSummary?.monthly;
  const invType = data.investmentType as string | undefined;
  const occ = occupancyHeading(invType, currentLeases);

  /**
   * Canonical “dashboard income” used across the app:
   * - contractual lease rent (active / month-to-month) + STR estimate (where applicable)
   * - expenses from ledger (including bond rows / inferred bond where needed)
   *
   * This keeps /owned-properties/dashboard and /owned-properties/:id consistent.
   */
  const kNoi = perf?.kpis?.monthlyNOI;
  const kExp = perf?.kpis?.monthlyExpenses;
  const incomeMonth = Number(kNoi?.operatingIncomeProjectedFromLeases ?? 0);
  const operatingExpMonth = Number(kExp?.operatingExpenses ?? 0);
  const bondMonth = Number(kExp?.debtService ?? 0);
  const noiOp = Number.isFinite(incomeMonth) && Number.isFinite(operatingExpMonth) ? incomeMonth - operatingExpMonth : null;
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

  /** CoC uses rental income only (RENT category, received this month) vs all expenses this month — annualised ×12; denominator from Edit Property. */
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

  const irrVp = perf?.portfolioIRR?.valuePercent;
  const irrPct = irrVp != null && Number.isFinite(Number(irrVp)) ? Number(irrVp) : null;

  const recent = (statement?.statementRows ?? []).slice(-8).reverse();

  /** Ledger-aligned only — do not fall back to dashboard-summary composition (STR adds synthetic Utilities/fees unrelated to deleted expenses). */
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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="pg-metric-grid">
        <button type="button" className="pg-metric-tile" onClick={() => navigate(`/owned-properties/${propertyId}?tab=leases`)}>
          <div className="pg-metric-tile-title">Occupancy status</div>
          <div className="pg-metric-tile-value">{occ}</div>
          <div className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>Open leases tab</div>
        </button>

        <button type="button" className="pg-metric-tile" onClick={() => navigate(`/owned-properties/${propertyId}?tab=tenants`)}>
          <div className="pg-metric-tile-title">Current tenants</div>
          <div className="pg-metric-tile-value">{data.tenants?.length ?? 0}</div>
          <div className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>
            {(data.tenants ?? []).slice(0, 2).map((t: any) => `${t.firstName} ${t.lastName}`).join(", ") || "None linked"}
          </div>
        </button>

        <button type="button" className="pg-metric-tile" onClick={() => navigate(`/owned-properties/${propertyId}?tab=financials&fin=statement`)}>
          <div className="pg-metric-tile-title">Monthly income</div>
          <div className="pg-metric-tile-value">R {incomeMonth.toLocaleString()}</div>
          <div className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>
            Received R {receivedMonth.toLocaleString()} · Expected R {expectedMonth.toLocaleString()}
          </div>
        </button>

        <button type="button" className="pg-metric-tile" onClick={() => navigate(`/owned-properties/${propertyId}?tab=financials&fin=statement`)}>
          <div className="pg-metric-tile-title">Monthly expenses</div>
          <div className="pg-metric-tile-value">R {operatingExpMonth.toLocaleString()}</div>
          <div className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>Bond/debt R {bondMonth.toLocaleString()}</div>
        </button>

        <div className="pg-metric-tile" style={{ cursor: "default" }}>
          <div className="pg-metric-tile-title">Monthly NOI (operating)</div>
          <div className="pg-metric-tile-value">{noiOp == null ? "—" : `R ${Math.round(noiOp).toLocaleString()}`}</div>
          <div className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>Excludes bond payment</div>
        </div>

        <div className="pg-metric-tile" style={{ cursor: "default" }}>
          <div className="pg-metric-tile-title">Monthly cash flow</div>
          <div className="pg-metric-tile-value">{cashAfterDebt == null ? "—" : `R ${Math.round(cashAfterDebt).toLocaleString()}`}</div>
          <div className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>NOI − debt service</div>
        </div>

        <div className="pg-metric-tile" style={{ cursor: "default" }}>
          <div className="pg-metric-tile-title">Equity</div>
          <div className="pg-metric-tile-value">{equity == null ? "Insufficient data" : `R ${Math.round(equity).toLocaleString()}`}</div>
        </div>

        <div className="pg-metric-tile" style={{ cursor: "default" }}>
          <div className="pg-metric-tile-title">True cash-on-cash ROI</div>
          <div className="pg-metric-tile-value">
            {cocPercent == null ? "Insufficient data" : `${cocPercent.toFixed(1)}%`}
          </div>
          <div className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>
            (Monthly rental income − monthly expenses) × 12 ÷ total cash invested × 100
          </div>
        </div>

        <div className="pg-metric-tile" style={{ cursor: "default" }}>
          <div className="pg-metric-tile-title">IRR</div>
          <div className="pg-metric-tile-value">{irrPct == null ? "Insufficient data" : `${irrPct.toFixed(2)}%`}</div>
          <div className="pg-muted" style={{ fontSize: 12, marginTop: 6 }}>Portfolio-level estimate when filtered</div>
        </div>

        <div className="pg-metric-tile" style={{ cursor: "default" }}>
          <div className="pg-metric-tile-title">Property type</div>
          <div className="pg-metric-tile-value" style={{ fontSize: 15 }}>{INV_LABEL[invType ?? "OTHER"] ?? invType ?? "—"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Card title="Income vs expenses (this property · calendar month)">
          {incomeExpenseDoughnut ? (
            <>
              <Doughnut data={incomeExpenseDoughnut} options={doughnutOptions} />
              <div className="pg-muted" style={{ fontSize: 12, marginTop: 10 }}>
                Income in teal / blue tones; each expense category has its own shade — largest expense this month is the darkest red, then deeper oranges.
              </div>
            </>
          ) : (
            <div className="pg-muted">No composition data for this period. Add income or expenses for the current month.</div>
          )}
        </Card>
        <Card title="NOI trend">
          {perf?.charts?.monthlyNOITrend?.length ? (
            <Line
              data={{
                labels: perf.charts.monthlyNOITrend.map((r: any) => r.label),
                datasets: [
                  {
                    label: "NOI",
                    data: perf.charts.monthlyNOITrend.map((r: any) => r.noi),
                    borderColor: "#4D96FF",
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

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <Card title="Lease status">
          {currentLeases.length === 0 ? (
            <div className="pg-muted">No current lease linked to this property.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div>Contractual rent roll: <strong>R {combinedContractRent.toLocaleString()}</strong>/mo</div>
              <div className="pg-muted">{currentLeases.length} active lease</div>
              <button type="button" className="pg-btn pg-btn-ghost" onClick={() => navigate(`/owned-properties/${propertyId}?tab=leases`)}>
                Open leases
              </button>
            </div>
          )}
        </Card>

        <Card title="Current invoice">
          {!statement?.currentInvoice ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div className="pg-muted">Create your first invoice for this property.</div>
              <button type="button" className="pg-btn pg-btn-primary" onClick={() => navigate(`/owned-properties/${propertyId}?tab=financials&fin=invoice`)}>
                Open invoice workspace
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              <div><strong>{statement.currentInvoice.invoiceNumber}</strong> ({statement.currentInvoice.status})</div>
              <div>Due: {statement.currentInvoice.dueDate ? new Date(statement.currentInvoice.dueDate).toLocaleDateString() : "—"}</div>
              <div>Total: R {Number(statement.currentInvoice.total ?? 0).toLocaleString()}</div>
              <button type="button" className="pg-btn pg-btn-ghost" onClick={() => navigate(`/owned-properties/${propertyId}?tab=financials&fin=invoice`)}>
                View in financials
              </button>
            </div>
          )}
        </Card>

        <Card title="Recent ledger lines">
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

      {(data.aggregateMeta?.alerts ?? []).length > 0 ? (
        <Card title="Alerts">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(data.aggregateMeta.alerts as string[]).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
