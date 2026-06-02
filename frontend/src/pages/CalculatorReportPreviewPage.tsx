import { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { AppListPage, AppPageActions, AppPageContent, AppPageHeader, AppPageSection, AppPageSubtitle, AppPageTitle } from "../components/ui/AppPage";
import { AppMetricCard, Card } from "../components/ui/Card";
import { Button, ButtonLink } from "../components/ui/Button";
import { formatRand } from "../utils/mortgageRepayment";
import { loadCalculatorReportPayload } from "../features/calculators/calculatorReportStorage";
import { CashFlowTrendChart, IncomeVsExpensesChart } from "../features/calculators/CalculatorsReportPreviewCharts";

export function CalculatorReportPreviewPage() {
  const { id } = useParams();
  const reportId = String(id ?? "").trim();

  const payload = useMemo(() => (reportId ? loadCalculatorReportPayload(reportId) : null), [reportId]);
  const metrics = payload?.metrics ?? null;
  const projectionAssumptions = payload?.projectionAssumptions ?? null;

  return (
    <AppListPage className="pg-calculators-report-page">
      <Helmet>
        <title>Report preview | Proplytic</title>
      </Helmet>

      <AppPageContent>
        <AppPageHeader>
          <div className="pg-app-page-header__main">
            <AppPageTitle>Report Preview</AppPageTitle>
            <AppPageSubtitle>
              {payload ? `Generated from ${payload.propertyType.replace(/-/g, " ")} inputs.` : "Report data missing."}
            </AppPageSubtitle>
          </div>
          <AppPageActions>
            <ButtonLink href="/calculators" variant="secondary">
              Back to Calculators
            </ButtonLink>
            <Button type="button" variant="primary" disabled>
              Generate PDF (coming soon)
            </Button>
          </AppPageActions>
        </AppPageHeader>

        {!payload ? (
          <AppPageSection>
            <Card title="Missing report">
              <div className="pg-muted">
                This report payload is no longer available. Go back to the calculators page and generate a new report.
              </div>
            </Card>
          </AppPageSection>
        ) : (
          <>
            <AppPageSection>
              <Card title="Key metrics">
                <div className="pg-calculators-metrics-6">
                  <AppMetricCard
                    label="Projected Cash Flow"
                    value={metrics?.projectedCashFlow == null ? "—" : formatRand(metrics.projectedCashFlow)}
                    icon="wallet"
                  />
                  <AppMetricCard
                    label="Gross Yield"
                    value={metrics?.grossYield == null ? "—" : `${metrics.grossYield.toFixed(1)}%`}
                    icon="percent"
                  />
                  <AppMetricCard
                    label="Cash on Cash ROI"
                    value={metrics?.cashOnCashRoi == null ? "—" : `${metrics.cashOnCashRoi.toFixed(1)}%`}
                    icon="income"
                  />
                  <AppMetricCard
                    label="Monthly Income"
                    value={metrics?.monthlyIncome == null ? "—" : formatRand(metrics.monthlyIncome)}
                    icon="income"
                  />
                  <AppMetricCard
                    label="Monthly Expenses"
                    value={metrics?.monthlyExpenses == null ? "—" : formatRand(metrics.monthlyExpenses)}
                    icon="expense"
                    iconAccent="danger"
                  />
                  <AppMetricCard
                    label="Units Occupied"
                    value={metrics?.unitsOccupied == null ? "—" : `${metrics.unitsOccupied.occupied}/${metrics.unitsOccupied.total}`}
                    icon="units"
                  />
                </div>
              </Card>
            </AppPageSection>

            <AppPageSection>
              <div className="pg-calculators-charts-2">
                <Card title="Income vs Expenses (Monthly)">
                  <IncomeVsExpensesChart metrics={metrics} />
                </Card>
                <Card title="5-Year Projected Cash Flow">
                  <CashFlowTrendChart metrics={metrics} projectionAssumptions={projectionAssumptions} />
                </Card>
              </div>
            </AppPageSection>

            <AppPageSection>
              <Card title="Inputs used">
                <div className="pg-muted">
                  This view is a summary. The underlying inputs are stored with the report and used to generate the PDF.
                </div>
              </Card>
            </AppPageSection>
          </>
        )}
      </AppPageContent>
    </AppListPage>
  );
}

