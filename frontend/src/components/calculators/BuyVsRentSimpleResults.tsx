import { Bar, Line } from "react-chartjs-2";
import type { ChartData } from "@calculatorShared/calculatorTypes";
import type {
  SimpleBuyVsRentComparisonTable,
  SimpleBuyVsRentCoreResult,
  SimpleBuyVsRentSummary,
  SimpleBuyVsRentYearRow
} from "@calculatorShared/buyVsRentSimple/simpleBuyVsRentTypes";
import { formatCompactZar } from "@calculatorShared/buyVsRentSimple/simpleBuyVsRentCalculator";
import { Card } from "../ui/Card";

type Props = {
  core: SimpleBuyVsRentCoreResult;
  charts: ChartData[];
  interpretationText: string;
  warnings: string[];
  assumptions: string[];
  assumptionsNote?: string;
  upgradePrompt?: { title: string; body: string };
  getChartOptions: (base?: Record<string, unknown>) => Record<string, unknown>;
};

function formatZar(n: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0
  }).format(n);
}

function verdictAccent(verdict: SimpleBuyVsRentSummary["verdict"]): string {
  if (verdict === "buy") return "pg-buy-vs-rent-card--buy";
  if (verdict === "rent") return "pg-buy-vs-rent-card--rent";
  return "pg-buy-vs-rent-card--close";
}

function betterRowClass(side: "buy" | "rent" | "tie", row: "buy" | "rent"): string {
  if (side === "tie") return "";
  return side === row ? "pg-buy-vs-rent-table-better" : "";
}

function ComparisonTable({ table }: { table: SimpleBuyVsRentComparisonTable }) {
  const better = table.betterFinalPosition;
  const rows: Array<{ metric: string; buy: string; rent: string; buyRow?: boolean; rentRow?: boolean }> = [
    {
      metric: "Final position",
      buy: formatCompactZar(table.finalPositionBuy),
      rent: formatCompactZar(table.finalPositionRent),
      buyRow: better === "buy",
      rentRow: better === "rent"
    },
    {
      metric: "Starting monthly cost",
      buy: formatCompactZar(table.startingMonthlyCostBuy),
      rent: formatCompactZar(table.startingMonthlyCostRent)
    },
    {
      metric: "Total paid over period",
      buy: formatCompactZar(table.totalPaidBuy),
      rent: formatCompactZar(table.totalPaidRent)
    },
    { metric: "Flexibility", buy: "Lower", rent: "Higher" },
    { metric: "Maintenance responsibility", buy: "Yours", rent: "Landlord" },
    { metric: "Long-term upside", buy: "Property growth", rent: "Investment growth" }
  ];

  return (
    <Card title="How they stack up">
      <div className="pg-buy-vs-rent-table-wrap">
        <table className="pg-buy-vs-rent-table">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Buying</th>
              <th scope="col">Renting</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric}>
                <td>{row.metric}</td>
                <td className={row.buyRow ? "pg-buy-vs-rent-table-better" : betterRowClass(better, "buy")}>{row.buy}</td>
                <td className={row.rentRow ? "pg-buy-vs-rent-table-better" : betterRowClass(better, "rent")}>{row.rent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function YearByYearAccordion({ rows }: { rows: SimpleBuyVsRentYearRow[] }) {
  return (
    <details className="pg-buy-vs-rent-year-summary">
      <summary>View year-by-year summary</summary>
      <div className="pg-buy-vs-rent-table-wrap" style={{ marginTop: 12 }}>
        <table className="pg-buy-vs-rent-table pg-buy-vs-rent-table--compact">
          <thead>
            <tr>
              <th>Year</th>
              <th>Buy position</th>
              <th>Rent position</th>
              <th>Better</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <td>{r.year}</td>
                <td>{formatCompactZar(r.netBuyingPosition)}</td>
                <td>{formatCompactZar(r.netRentingPosition)}</td>
                <td>{r.betterOption === "tie" ? "Close" : r.betterOption === "buy" ? "Buy" : "Rent"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function BuyVsRentSimpleResults({
  core,
  charts,
  interpretationText,
  warnings,
  assumptions,
  assumptionsNote,
  upgradePrompt,
  getChartOptions
}: Props) {
  const s = core.summary;

  const resultCards = [
    { label: "Better option", value: s.betterOptionLabel, accent: true },
    { label: "Difference after selected period", value: s.differenceHeadline },
    { label: "Estimated home equity", value: s.homeEquityHeadline },
    { label: "Estimated renting investment", value: s.rentingInvestmentHeadline },
    { label: "Break-even point", value: s.breakEvenHeadline }
  ];

  return (
    <div className="pg-buy-vs-rent-results" style={{ display: "grid", gap: 16 }}>
      <div className="pg-buy-vs-rent-cards">
        {resultCards.map((card, idx) => (
          <Card
            key={card.label}
            pad={false}
            className={`pg-card-pad pg-calculator-kpi-card ${idx === 0 ? verdictAccent(s.verdict) : ""}`}
          >
            <div className="pg-kpi">
              <div className="pg-kpi-value pg-buy-vs-rent-card-value">{card.value}</div>
              <div className="pg-kpi-label">{card.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {charts.map((ch, idx) => (
        <Card key={`${ch.title ?? "chart"}-${idx}`} title={ch.title ?? "Chart"}>
          <div className="pg-calculator-chart-host">
            {ch.chartType === "line" ? (
              <Line data={ch.data as never} options={getChartOptions(ch.options as Record<string, unknown>) as never} />
            ) : (
              <Bar data={ch.data as never} options={getChartOptions(ch.options as Record<string, unknown>) as never} />
            )}
          </div>
        </Card>
      ))}

      <ComparisonTable table={core.comparisonTable} />

      <Card title="What this means">
        <p className="pg-muted" style={{ margin: 0, lineHeight: 1.6 }}>
          {interpretationText}
        </p>
        {warnings.length ? (
          <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>
            {warnings.join(" · ")}
          </div>
        ) : null}
        <p className="pg-muted" style={{ margin: "12px 0 0", fontSize: 13 }}>
          Bond on {formatZar(core.bondAmount)} over 20 years at {core.inputs.interestRate}% — monthly bond about{" "}
          {formatCompactZar(core.monthlyBondPayment)}. Upfront transfer &amp; bond costs about{" "}
          {formatCompactZar(core.upfrontBuyingCosts)}.
        </p>
      </Card>

      <YearByYearAccordion rows={core.yearRows} />

      <details className="pg-calculator-assumptions-used">
        <summary>Assumptions used</summary>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
          {assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        {assumptionsNote ? (
          <p className="pg-muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
            {assumptionsNote}
          </p>
        ) : null}
      </details>

      {upgradePrompt ? (
        <div className="pg-buy-vs-rent-upgrade">
          <p className="pg-buy-vs-rent-upgrade-title">{upgradePrompt.title}</p>
          <p className="pg-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {upgradePrompt.body}
          </p>
        </div>
      ) : null}
    </div>
  );
}
