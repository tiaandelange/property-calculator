import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Grid } from "../components/ui/Grid";
import { Button } from "../components/ui/Button";
import { getProperties, getProperty } from "../api/ownedProperties";
import { PROPERTY_DATA_INVALIDATION } from "../features/properties/invalidate";
import { AlertBanner, DashboardCard, EmptyState, MetricCard, SkeletonGrid, StatCard, StatusPill } from "../components/ui/DashboardKit";
import { getChartCategoryPalette, getChartSemanticColors } from "../theme/cssTokens";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip, PointElement, LineElement);

export function OwnedPropertiesDashboardPage() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [details, setDetails] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const chartColors = useMemo(() => getChartSemanticColors(), []);
  const chartPalette = useMemo(() => getChartCategoryPalette(), []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const properties = await getProperties();
      setRows(properties);
      const settled = await Promise.allSettled(properties.map((p: any) => getProperty(p.id)));
      const ok = settled
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => r.value);
      const failed = settled.filter((r) => r.status === "rejected");
      if (failed.length) {
        console.error("[OwnedPropertiesDashboard] Some property detail loads failed", failed);
      }
      setDetails(ok);
    } catch (e: any) {
      console.error("[OwnedPropertiesDashboard] Failed to load properties", e);
      setError(e?.response?.data?.message ?? "Could not load properties. Please refresh or check the server.");
    } finally {
      setLoading(false);
    }
  };

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const handler = () => void loadRef.current();
    window.addEventListener(PROPERTY_DATA_INVALIDATION, handler);
    return () => window.removeEventListener(PROPERTY_DATA_INVALIDATION, handler);
  }, []);

  const stats = useMemo(() => {
    const total = details.length;
    const occupied = details.filter((p) => (p.leases ?? []).some((l: any) => l.status === "ACTIVE")).length;
    const vacant = total - occupied;
    const occupancyRate = total > 0 ? (occupied / total) * 100 : 0;
    /** Align with workspace Financials / statement: calendar-month totals + paid invoices (see computeFinancialSummary). */
    const monthlyIncome = details.reduce((acc, p) => acc + Number(p.financialSummary?.monthly?.totalIncome ?? 0), 0);
    const monthlyExpenses = details.reduce((acc, p) => acc + Number(p.financialSummary?.monthly?.totalExpenses ?? 0), 0);
    const netCashFlow = details.reduce((acc, p) => acc + Number(p.financialSummary?.monthly?.netMonthlyCashFlow ?? 0), 0);
    const totalPropertyValue = details.reduce((a, p) => a + Number(p.currentEstimatedValue ?? 0), 0);
    const totalOutstandingBonds = details.reduce((a, p) => a + Number(p.outstandingBondBalance ?? 0), 0);
    const portfolioEquity = totalPropertyValue - totalOutstandingBonds;
    const leases = details.flatMap((p) => p.leases ?? []);
    const activeLeases = leases.filter((l: any) => ["ACTIVE", "MONTH_TO_MONTH"].includes(l.status));
    const depositsHeld = activeLeases.reduce((a: number, l: any) => a + Number(l.depositAmount ?? 0), 0);
    const monthlyRentRoll = activeLeases.reduce((a: number, l: any) => a + Number(l.monthlyRent ?? 0), 0);
    const totalPurchasePrice = details.reduce((a, p) => a + Number(p.purchasePrice ?? 0), 0);
    const annualRent = monthlyRentRoll * 12;
    const annualNetCashFlow = netCashFlow * 12;
    const averageGrossYield = totalPurchasePrice > 0 ? annualRent / totalPurchasePrice : null;
    const averageNetYield = totalPropertyValue > 0 ? annualNetCashFlow / totalPropertyValue : null;

    const today = new Date();
    const in90 = new Date();
    in90.setDate(today.getDate() + 90);
    const in7 = new Date();
    in7.setDate(today.getDate() + 7);
    const monthToMonth = activeLeases.filter((l: any) => l.status === "MONTH_TO_MONTH").length;
    const expiringSoon = activeLeases.filter((l: any) => {
      const d = l.fixedTermEndDate ?? l.endDate;
      if (!d) return false;
      const dt = new Date(d);
      return dt >= today && dt <= in90;
    }).length;
    const leasesToRenewCount = monthToMonth + expiringSoon;

    const invoices = details.flatMap((p) => p.invoices ?? []);
    const unpaid = invoices.filter((i: any) => !["PAID", "CANCELLED"].includes(i.status));
    const overdueSet = new Set<string>();
    const dueSoonSet = new Set<string>();
    unpaid.forEach((i: any) => {
      const due = new Date(i.dueDate);
      const key = `${i.tenantId}-${due.getFullYear()}-${due.getMonth() + 1}`;
      if (today > due) overdueSet.add(key);
      else if (due >= today && due <= in7) dueSoonSet.add(key);
    });
    const rentAttentionCount = overdueSet.size + dueSoonSet.size;

    const missingValuation = details.filter((p) => p.currentEstimatedValue == null).length;
    const missingBond = details.filter((p) => p.outstandingBondBalance == null).length;
    const noLeaseDocument = details.filter((p) => (p.leases ?? []).some((l: any) => l.status === "ACTIVE") && !(p.documents ?? []).length).length;

    return {
      total,
      occupied,
      vacant,
      occupancyRate,
      monthlyIncome,
      monthlyExpenses,
      netCashFlow,
      totalPropertyValue,
      totalOutstandingBonds,
      portfolioEquity,
      depositsHeld,
      monthlyRentRoll,
      averageGrossYield,
      averageNetYield,
      leasesToRenewCount,
      rentAttentionCount,
      overdueRentCount: overdueSet.size,
      dueSoonRentCount: dueSoonSet.size,
      expiredLeases: 0,
      expiringSoon,
      monthToMonth,
      missingValuation,
      missingBond,
      noLeaseDocument
    };
  }, [details]);

  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    const add = (label: string, v: number) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return;
      map.set(label, (map.get(label) ?? 0) + n);
    };
    details.forEach((p) => {
      const m = p.financialSummary?.monthly;
      if (!m) return;
      add("Rates & Taxes", Number(m.totalRatesTaxes ?? 0));
      add("Water", Number(m.totalWater ?? 0));
      add("Electricity", Number(m.totalElectricity ?? 0));
      add("Levies", Number(m.totalLevies ?? 0));
      add("Insurance", Number(m.totalInsurance ?? 0));
      add("Maintenance / Repairs", Number(m.totalMaintenance ?? 0));
      add("Bond / Debt service", Number(m.totalBondPayment ?? 0));
      add("Other", Number(m.totalOtherExpenses ?? 0));
    });
    return Array.from(map.entries());
  }, [details]);

  const hasData = rows.length > 0;
  const showEmpty = !loading && !hasData;

  return (
    <Section>
      <Helmet>
        <title>Owned Properties | The Property Guy</title>
      </Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Your Property Portfolio</h1>
            <p className="pg-lead" style={{ margin: "8px 0 0" }}>Track income, expenses, leases and portfolio equity in one place.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={load} loading={loading}>Refresh</Button>
            <Link className="pg-btn pg-btn-secondary" to="/owned-properties/new">Add Property</Link>
            <Link className="pg-btn pg-btn-ghost" to="/financials">Add Income/Expense</Link>
            <Link className="pg-btn pg-btn-ghost" to="/invoices">Generate Portfolio Report</Link>
          </div>
        </div>
        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        {loading ? <SkeletonGrid count={6} columns={3} /> : null}
        {showEmpty ? (
          <EmptyState
            iconPreset="portfolio-value"
            title="Start building your portfolio dashboard"
            body="Add your first property to track rent, expenses, leases, documents and portfolio equity."
            actions={
              <>
                <Link className="pg-btn pg-btn-primary" to="/owned-properties/new">Add Property</Link>
                <Link className="pg-btn pg-btn-ghost" to="/calculators/cash-on-cash-return">Try Investment Calculator</Link>
              </>
            }
          />
        ) : null}
        {hasData ? (
          <>
            <Grid cols={3}>
              <StatCard
                title="Portfolio Equity / Net Worth"
                value={stats.missingBond > 0 ? "Missing data" : `R ${stats.portfolioEquity.toLocaleString()}`}
                hint="Total property value less outstanding bonds."
                tone="accent"
                iconPreset="portfolio-value"
                onClick={() => navigate("/owned-properties/metrics/equity")}
                ariaLabel="View portfolio equity details"
              />
              <StatCard
                title="Total Properties"
                value={stats.total}
                iconPreset="total-properties"
                onClick={() => navigate("/owned-properties")}
                ariaLabel="View all owned properties"
              />
              <StatCard
                title="Occupied Properties"
                value={`${stats.occupied} (${stats.occupancyRate.toFixed(0)}%)`}
                iconPreset="occupancy"
                iconTone="success"
                onClick={() => navigate("/owned-properties/metrics/leases")}
                ariaLabel="View lease details"
              />
              <StatCard
                title="Monthly Net Cash Flow"
                value={`R ${stats.netCashFlow.toLocaleString()}`}
                tone={stats.netCashFlow >= 0 ? "success" : "danger"}
                iconPreset="cash-flow"
                iconTone={stats.netCashFlow >= 0 ? "success" : "danger"}
                onClick={() => navigate("/owned-properties/metrics/cash-flow")}
                ariaLabel="View cash flow details"
              />
              <StatCard
                title="Rent Due / Overdue"
                value={`${stats.rentAttentionCount} rent items need attention`}
                tone={stats.overdueRentCount > 0 ? "danger" : stats.dueSoonRentCount > 0 ? "warning" : "success"}
                iconPreset="rent-due"
                iconTone={stats.overdueRentCount > 0 ? "danger" : stats.dueSoonRentCount > 0 ? "warning" : "success"}
                onClick={() => navigate("/owned-properties/metrics/rent-due")}
                ariaLabel="View rent due and overdue details"
              />
              <StatCard
                title="Lease Renewals"
                value={`${stats.leasesToRenewCount} leases to renew`}
                tone={stats.expiringSoon > 0 || stats.monthToMonth > 0 ? "warning" : "success"}
                iconPreset="leases"
                iconTone={stats.expiringSoon > 0 || stats.monthToMonth > 0 ? "warning" : "primary"}
                onClick={() => navigate("/owned-properties/metrics/leases")}
                ariaLabel="View lease renewals details"
              />
            </Grid>
            <div style={{ height: 12 }} />
            <Grid cols={3}>
              <MetricCard
                title="Deposits Held"
                value={`R ${stats.depositsHeld.toLocaleString()}`}
                iconPreset="deposits"
                onClick={() => navigate("/owned-properties/metrics/deposits")}
                ariaLabel="View deposits held details"
              />
              <MetricCard title="Monthly Rent Roll" value={`R ${stats.monthlyRentRoll.toLocaleString()}`} iconPreset="monthly-income" />
              <MetricCard title="Monthly Expenses" value={`R ${stats.monthlyExpenses.toLocaleString()}`} iconPreset="expenses" />
              <MetricCard title="Vacancy Count" value={stats.vacant} iconPreset="vacancy" />
              <MetricCard
                title="Average Gross Yield"
                value={stats.averageGrossYield == null ? "Missing data" : `${(stats.averageGrossYield * 100).toFixed(2)}%`}
                iconPreset="yield"
              />
              <MetricCard
                title="Average Net Yield"
                value={stats.averageNetYield == null ? "Missing data" : `${(stats.averageNetYield * 100).toFixed(2)}%`}
                iconPreset="yield"
              />
            </Grid>
            <div style={{ height: 12 }} />
            <DashboardCard title="Alerts & Actions">
              <div style={{ display: "grid", gap: 10 }}>
                {stats.monthToMonth > 0 ? <AlertBanner tone="warning" title="Month-to-month leases" message={`${stats.monthToMonth} leases are month-to-month.`} action={<Link className="pg-btn pg-btn-ghost" to="/leases">Review</Link>} /> : null}
                {stats.expiringSoon > 0 ? <AlertBanner tone="warning" title="Lease expiring within 90 days" message={`${stats.expiringSoon} leases need renewal soon.`} action={<Link className="pg-btn pg-btn-ghost" to="/leases">Renew</Link>} /> : null}
                {stats.overdueRentCount > 0 ? <AlertBanner tone="danger" title="Rent overdue" message={`${stats.overdueRentCount} tenants are overdue.`} action={<Link className="pg-btn pg-btn-ghost" to="/invoices">Collect</Link>} /> : null}
                {stats.dueSoonRentCount > 0 ? <AlertBanner tone="warning" title="Rent due within 7 days" message={`${stats.dueSoonRentCount} rent payments due soon.`} action={<Link className="pg-btn pg-btn-ghost" to="/invoices">Prepare</Link>} /> : null}
                {stats.missingValuation > 0 ? <AlertBanner tone="accent" title="Missing valuation" message={`Add current value for ${stats.missingValuation} properties to calculate equity.`} action={<Link className="pg-btn pg-btn-ghost" to="/owned-properties">Update</Link>} /> : null}
                {stats.missingBond > 0 ? <AlertBanner tone="accent" title="Missing bond balance" message={`Add bond balances for ${stats.missingBond} properties to improve net worth accuracy.`} action={<Link className="pg-btn pg-btn-ghost" to="/owned-properties">Add bond balance</Link>} /> : null}
                {stats.noLeaseDocument > 0 ? <AlertBanner tone="accent" title="No lease uploaded" message={`${stats.noLeaseDocument} active properties have no lease document.`} action={<Link className="pg-btn pg-btn-ghost" to="/documents">Upload</Link>} /> : null}
              </div>
            </DashboardCard>
            <div style={{ height: 12 }} />
            <Grid cols={2}>
              <DashboardCard title="Portfolio Value vs Bonds">
                <Bar data={{ labels: ["Value", "Bonds", "Equity"], datasets: [{ label: "Portfolio (R)", data: [stats.totalPropertyValue, stats.totalOutstandingBonds, stats.portfolioEquity], backgroundColor: [chartColors.info, chartColors.warning, chartColors.success] }] }} />
              </DashboardCard>
              <DashboardCard title="Occupancy">
                <Doughnut data={{ labels: ["Occupied", "Vacant"], datasets: [{ data: [stats.occupied, stats.vacant], backgroundColor: [chartColors.success, chartColors.muted] }] }} />
              </DashboardCard>
              <DashboardCard title="Monthly Income vs Expenses">
                <Line data={{ labels: ["Current"], datasets: [{ label: "Income", data: [stats.monthlyIncome], borderColor: chartColors.success, backgroundColor: chartColors.successSoft }, { label: "Expenses", data: [stats.monthlyExpenses], borderColor: chartColors.danger, backgroundColor: chartColors.dangerSoft }] }} />
              </DashboardCard>
              <DashboardCard title="Expense Breakdown">
                {expenseBreakdown.length ? (
                  <Doughnut data={{ labels: expenseBreakdown.map(([k]) => k), datasets: [{ data: expenseBreakdown.map(([, v]) => v), backgroundColor: chartPalette }] }} />
                ) : (
                  <div className="pg-muted">No expense data yet.</div>
                )}
              </DashboardCard>
            </Grid>
            <div style={{ height: 12 }} />
            <Grid cols={3}>
              {details.map((p) => {
                const activeLease = (p.leases ?? []).find((l: any) => ["ACTIVE", "MONTH_TO_MONTH"].includes(l.status));
                const monthlyIncome = Number(p.financialSummary?.monthly?.totalIncome ?? 0);
                const monthlyExpenses = Number(p.financialSummary?.monthly?.totalExpenses ?? 0);
                const cash = Number(p.financialSummary?.monthly?.netMonthlyCashFlow ?? monthlyIncome - monthlyExpenses);
                const overdue = (p.invoices ?? []).some((i: any) => !["PAID", "CANCELLED"].includes(i.status) && new Date(i.dueDate) < new Date());
                const status = overdue ? "Rent Overdue" : p.occupancyStatus === "OCCUPIED" ? "Occupied" : "Vacant";
                const tone = overdue ? "danger" : activeLease ? "success" : "warning";
                return (
                  <div key={p.id} className="pg-property-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{p.name}</h3>
                        <div className="pg-muted">{p.addressLine1}, {p.city}</div>
                      </div>
                      <StatusPill label={status} tone={tone as any} />
                    </div>
                    <div className="pg-property-metrics">
                      <div>Current value: {p.currentEstimatedValue == null ? <span className="pg-muted">Add value</span> : `R ${Number(p.currentEstimatedValue).toLocaleString()}`}</div>
                      <div>Outstanding bond: {p.outstandingBondBalance == null ? <span className="pg-muted">Add bond balance</span> : `R ${Number(p.outstandingBondBalance).toLocaleString()}`}</div>
                      <div>Equity: {p.currentEstimatedValue == null || p.outstandingBondBalance == null ? <span className="pg-muted">Missing data</span> : `R ${(Number(p.currentEstimatedValue) - Number(p.outstandingBondBalance)).toLocaleString()}`}</div>
                      <div>Monthly rent: {p.currentLease ? `R ${Number(p.currentLease.monthlyRent ?? 0).toLocaleString()}` : <span className="pg-muted">Missing data</span>}</div>
                      <div>Monthly expenses: R {monthlyExpenses.toLocaleString()}</div>
                      <div>Monthly net cash flow: <span style={{ color: cash >= 0 ? "var(--success)" : "var(--danger)" }}>R {cash.toLocaleString()}</span></div>
                      <div>
                        Active tenant: {p.currentTenant?.firstName ? (
                          <Link to={`/tenants/${p.currentTenant.id}`} className="pg-link">
                            {p.currentTenant.firstName} {p.currentTenant.lastName}
                          </Link>
                        ) : (
                          <span className="pg-muted">Missing data</span>
                        )}
                      </div>
                      <div>
                        Lease status: {p.currentLease?.displayStatus ?? <span className="pg-muted">Vacant</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}`}>View</Link>
                      <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=financials`}>Financials</Link>
                      <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=invoices`}>Invoices</Link>
                      <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=documents`}>Documents</Link>
                    </div>
                  </div>
                );
              })}
            </Grid>
          </>
        ) : null}
        {!loading && new URLSearchParams(search).get("empty") === "true" && hasData ? (
          <div className="pg-alert" style={{ marginTop: 12 }}>Portfolio loaded. Add detailed values (valuation/bond/leases) for complete metrics.</div>
        ) : null}
      </Container>
    </Section>
  );
}
