import { useMemo } from "react";
import {
  buildPortfolioProjectionYears,
  fmtPct,
  type PortfolioProjectionYearRow
} from "./portfolioProjectionUtils";
import { fmtZar } from "./portfolioDashboardUtils";

const COLUMNS: { key: keyof PortfolioProjectionYearRow; label: string; format: "year" | "zar" | "pct" }[] = [
  { key: "year", label: "Year", format: "year" },
  { key: "equity", label: "Equity", format: "zar" },
  { key: "cashFlow", label: "Cash flow", format: "zar" },
  { key: "income", label: "Income", format: "zar" },
  { key: "expenses", label: "Expenses", format: "zar" },
  { key: "cocRoi", label: "CoC ROI", format: "pct" },
  { key: "roi", label: "ROI", format: "pct" },
  { key: "irr", label: "IRR", format: "pct" }
];

function formatCellForColumn(row: PortfolioProjectionYearRow, col: (typeof COLUMNS)[number]): string {
  if (col.format === "year") return String(row.year);
  if (col.format === "pct") {
    const v = row[col.key];
    return fmtPct(typeof v === "number" ? v : null);
  }
  const v = row[col.key];
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
  const rows = useMemo(
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
      {rows.length === 0 ? (
        <p className="pg-pdash-empty-inline">
          Add property values, income, and cash invested to generate a 30-year projection.
        </p>
      ) : (
        <div className="pg-pdash-projection-table-wrap">
          <table className="pg-pdash-projection-table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} scope="col">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.year}>
                  {COLUMNS.map((col) => (
                    <td key={col.key} data-label={col.label}>
                      {formatCellForColumn(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 ? (
        <p className="pg-pdash-chart-note">
          Projections use admin growth defaults and property assumptions — illustrative, not stored.
        </p>
      ) : null}
    </div>
  );
}
