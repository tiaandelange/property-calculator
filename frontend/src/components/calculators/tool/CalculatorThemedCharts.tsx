import { Bar, Doughnut, Line } from "react-chartjs-2";
import { applyProplyticChartTheme, isDualAxisComboChartType } from "../../../utils/calculatorChartTheme";
import { getCalculatorChartTitle } from "../../../utils/calculatorResultsPresentation";
import { CalculatorToolResultsChartSection } from "./CalculatorToolResultsChartSection";

type ChartLike = Parameters<typeof applyProplyticChartTheme>[0];

type CalculatorThemedChartsProps = {
  slug: string;
  charts: ChartLike[];
  graphTitle?: string;
  mergeChartOptions: (base: Record<string, unknown> | null | undefined) => Record<string, unknown>;
  mergeMobileChartOptions: (
    base: Record<string, unknown> | null | undefined,
    chartType?: string,
    dualAxisCombo?: boolean
  ) => Record<string, unknown>;
  isMobile: boolean;
};

export function CalculatorThemedCharts({
  slug,
  charts,
  graphTitle,
  mergeChartOptions,
  mergeMobileChartOptions,
  isMobile
}: CalculatorThemedChartsProps) {
  if (!charts.length) return null;

  const chartOptionsForViewport = (
    base: Record<string, unknown> | null | undefined,
    chartType: string,
    dualAxisCombo: boolean
  ) => {
    if (isMobile) return mergeMobileChartOptions(base, chartType, dualAxisCombo);
    return mergeChartOptions(base);
  };

  return (
    <CalculatorToolResultsChartSection title={getCalculatorChartTitle(slug, graphTitle)}>
      {charts.map((ch, idx) => {
        const themed = applyProplyticChartTheme(ch, slug, graphTitle);
        const dualAxisCombo = isDualAxisComboChartType(themed);
        const opts = chartOptionsForViewport(
          themed.options as Record<string, unknown>,
          themed.chartType,
          dualAxisCombo
        ) as Record<string, unknown>;
        const displayTitle = themed.title ?? "Chart";
        const ChartComponent =
          themed.chartType === "line" ? Line : themed.chartType === "doughnut" ? Doughnut : Bar;
        const showInlineTitle = charts.length > 1;
        const isDoughnutChart = themed.chartType === "doughnut";

        return (
          <div
            key={`${displayTitle}-${idx}`}
            className={`pg-calc-tool-chart-item${isDoughnutChart ? " pg-calc-tool-chart-item--doughnut" : ""}`}
          >
            {showInlineTitle ? <h4 className="pg-calc-tool-chart-item__title">{displayTitle}</h4> : null}
            <div className="pg-calculator-chart-host">
              <ChartComponent data={themed.data as never} options={opts as never} />
            </div>
          </div>
        );
      })}
    </CalculatorToolResultsChartSection>
  );
}
