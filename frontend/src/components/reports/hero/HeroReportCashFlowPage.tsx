import { HERO_REPORT_CASH_FLOW } from "./heroReportSampleData";
import { MiniDonutChart } from "./MiniDonutChart";

const { title, rows, donut } = HERO_REPORT_CASH_FLOW;

export function HeroReportCashFlowPage() {
  return (
    <>
      <p className="pg-hero-report-kicker">Section 02</p>
      <h3 className="pg-hero-report-page-title">{title}</h3>
      <div className="pg-hero-report-cashflow">
        <MiniDonutChart segments={donut} />
        <table className="pg-hero-report-table pg-hero-report-table--compact pg-hero-report-cashflow__table">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={`pg-hero-report-cashflow__row--${row.tone}`}>
                <th scope="row">{row.label}</th>
                <td className="pg-hero-report-table__num">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
