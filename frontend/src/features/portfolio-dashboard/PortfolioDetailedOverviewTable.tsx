import { useMemo } from "react";
import {
  buildPortfolioProjectionYears,
  fmtPct,
  type PortfolioProjectionYearRow
} from "./portfolioProjectionUtils";
import { fmtZar } from "./portfolioDashboardUtils";

const METRIC_ROWS: {
  key: Exclude<keyof PortfolioProjectionYearRow, "year">;
  label: string;
  format: "zar" | "pct";
}[] = [
  { key: "equity", label: "Equity", format: "zar" },
  { key: "cashFlow", label: "Cash flow", format: "zar" },
  { key: "income", label: "Income", format: "zar" },
  { key: "expenses", label: "Expenses", format: "zar" },
  { key: "cocRoi", label: "CoC ROI", format: "pct" },
  { key: "roi", label: "ROI", format: "pct" },
  { key: "irr", label: "IRR", format: "pct" }
];

function formatMetricValue(
  row: PortfolioProjectionYearRow,
  metric: (typeof METRIC_ROWS)[number]
): string {
  if (metric.format === "pct") {
    const v = row[metric.key];
    return fmtPct(typeof v === "number" ? v : null);
  }
  const v = row[metric.key];
  return typeof v === "number" ? fmtZar(v) : "—";
}

export function PortfolioDetailedOverviewTable({
  data,
  properties,
  propertyTypes,
  propertyId
}: {
  data: Record<string, unknown> | null | undefined;
  properties: Record<string, unknown>[];
  propertyTypes?: string[];
  propertyId?: string | number | null;
}) {
  const yearColumns = useMemo(
    () =>
      buildPortfolioProjectionYears(data, properties, {
        propertyTypes: propertyTypes ?? [],
        propertyId: propertyId ?? null
      }),
    [data, properties, propertyTypes, propertyId]
  );

  return (
    <div className="pg-workspace-card pg-pdash-panel pg-pdash-analysis-panel">
      <div className="pg-pdash-panel-head">
        <h2 className="pg-pdash-panel-title">Detailed Overview</h2>
      </div>
      {yearColumns.length === 0 ? (
        <p className="pg-pdash-empty-inline">
          Add property values, income, and cash invested to generate a 30-year projection.
        </p>
      ) : (
        <div className="pg-pdash-projection-table-wrap">
          <table className="pg-pdash-projection-table pg-pdash-projection-table--transposed">
            <thead>
              <tr>
                <th scope="col" className="pg-pdash-projection-table-corner">
                  {/* Row labels below */}
                </th>
                {yearColumns.map((col) => (
                  <th key={col.year} scope="col">
                    Year {col.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((metric) => (
                <tr key={metric.key}>
                  <th scope="row">{metric.label}</th>
                  {yearColumns.map((col) => (
                    <td key={col.year}>{formatMetricValue(col, metric)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {yearColumns.length > 0 ? (
        <p className="pg-pdash-chart-note">
          Projections use admin growth defaults and property assumptions — illustrative, not stored.
        </p>
      ) : null}
    </div>
  );
}
