import {
  REPORTS_SAMPLE_PROPERTY,
  type ReportsSampleMetrics
} from "../../data/reportsSamplePreview";

type PageProps = {
  metrics: ReportsSampleMetrics;
};

export function ReportsSampleA4Page1({ metrics }: PageProps) {
  const p = REPORTS_SAMPLE_PROPERTY;
  const m = metrics.format;

  return (
    <div className="pg-reports-sample-a4__sheet-inner">
      <header className="pg-reports-sample-a4__head">
        <div className="pg-reports-sample-a4__brand">
          <img src="/proplytic_logo_600x200_nobg.png" alt="" width={120} height={40} />
        </div>
        <div className="pg-reports-sample-a4__landlord">
          <strong>{p.landlordName}</strong>
          <span>{p.landlordLine}</span>
        </div>
      </header>

      <h3 className="pg-reports-sample-a4__report-title">Investor Property Report</h3>
      <p className="pg-reports-sample-a4__report-subtitle">
        {p.name} — {p.location}
      </p>
      <p className="pg-reports-sample-a4__date">Generated 3 June 2026 · Sample preview</p>

      <section className="pg-reports-sample-a4__section">
        <h4>1. Executive Summary</h4>
        <p className="pg-reports-sample-a4__prose">
          This sample illustrates how Proplytic packages property performance into a polished PDF for owners and
          investors. Figures below are derived from the demo property inputs shown in your workspace.
        </p>
      </section>

      <section className="pg-reports-sample-a4__section">
        <h4>2. Property Snapshot</h4>
        <dl className="pg-reports-sample-a4__kv-grid">
          <div>
            <dt>Purchase price</dt>
            <dd>{m.purchasePrice}</dd>
          </div>
          <div>
            <dt>Estimated market value</dt>
            <dd>{m.marketValue}</dd>
          </div>
          <div>
            <dt>Monthly rental income</dt>
            <dd>{m.monthlyRentalIncome}</dd>
          </div>
          <div>
            <dt>Vacancy allowance</dt>
            <dd>{p.vacancyPercent}%</dd>
          </div>
        </dl>
      </section>

      <section className="pg-reports-sample-a4__section">
        <h4>3. Key Metrics</h4>
        <div className="pg-reports-sample-a4__metrics">
          {[
            ["Market value", m.marketValue],
            ["Monthly rental income", m.monthlyRentalIncome],
            ["Est. bond payment", m.monthlyBondPayment],
            ["Net cash flow", m.netCashFlow],
            ["Gross yield", m.grossYield],
            ["Loan-to-value", m.loanToValue],
            ["Estimated equity", m.estimatedEquity]
          ].map(([label, value]) => (
            <div key={label} className="pg-reports-sample-a4__metric">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="pg-reports-sample-a4__section pg-reports-sample-a4__section--compact pg-reports-sample-a4__section--mobile-summary">
        <h4>4. Monthly Cash Flow</h4>
        <p className="pg-reports-sample-a4__prose">
          Effective rent {m.effectiveRent} · Operating expenses {m.operatingExpenses} · Debt service{" "}
          {m.monthlyBondPayment} → Net {m.netCashFlow}/mo
        </p>
      </section>

      <section className="pg-reports-sample-a4__section pg-reports-sample-a4__section--compact pg-reports-sample-a4__section--mobile-extra">
        <h4>5. Investment Notes</h4>
        <p className="pg-reports-sample-a4__prose">
          Cash-on-cash return {m.cashOnCash} on {m.cashInvested} cash invested. NOI {m.netOperatingIncome}/mo before
          debt.
        </p>
      </section>

      <footer className="pg-reports-sample-a4__footer">Page 1 · Executive Summary · Sample data only</footer>
    </div>
  );
}

export function ReportsSampleA4Page2({ metrics }: PageProps) {
  const m = metrics.format;

  return (
    <div className="pg-reports-sample-a4__sheet-inner">
      <header className="pg-reports-sample-a4__head pg-reports-sample-a4__head--compact">
        <span className="pg-reports-sample-a4__mini-brand">Proplytic</span>
        <span className="pg-reports-sample-a4__mini-title">Cash Flow &amp; Financing</span>
      </header>

      <section className="pg-reports-sample-a4__section">
        <h4>Monthly cash flow breakdown</h4>
        <table className="pg-reports-sample-a4__table">
          <thead>
            <tr>
              <th scope="col">Line item</th>
              <th scope="col">Monthly</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gross rental income</td>
              <td>{m.monthlyRentalIncome}</td>
            </tr>
            <tr>
              <td>Vacancy-adjusted income</td>
              <td>{m.effectiveRent}</td>
            </tr>
            <tr>
              <td>Operating expenses</td>
              <td>{m.operatingExpenses}</td>
            </tr>
            <tr>
              <td>Net operating income</td>
              <td>{m.netOperatingIncome}</td>
            </tr>
            <tr>
              <td>Bond repayment</td>
              <td>{m.monthlyBondPayment}</td>
            </tr>
            <tr className="pg-reports-sample-a4__table-total">
              <td>Net cash flow</td>
              <td>{m.netCashFlow}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="pg-reports-sample-a4__section">
        <h4>Financing snapshot</h4>
        <dl className="pg-reports-sample-a4__kv-grid">
          <div>
            <dt>Bond amount</dt>
            <dd>{m.bondAmount}</dd>
          </div>
          <div>
            <dt>Interest rate</dt>
            <dd>{REPORTS_SAMPLE_PROPERTY.interestRatePercent}%</dd>
          </div>
          <div>
            <dt>Loan term</dt>
            <dd>{REPORTS_SAMPLE_PROPERTY.loanTermYears} years</dd>
          </div>
          <div>
            <dt>Expense ratio</dt>
            <dd>{m.expenseRatio}</dd>
          </div>
        </dl>
      </section>

      <div className="pg-reports-sample-a4__bar-chart" aria-hidden>
        <span style={{ height: "72%" }} />
        <span style={{ height: "58%" }} />
        <span style={{ height: "64%" }} />
        <span style={{ height: "48%" }} />
        <span style={{ height: "55%" }} />
        <span style={{ height: "42%" }} />
      </div>
      <p className="pg-reports-sample-a4__chart-caption">Illustrative 6-month net cash flow trend</p>

      <footer className="pg-reports-sample-a4__footer">Page 2 · Cash Flow &amp; Financing · Sample data only</footer>
    </div>
  );
}

export function ReportsSampleA4Page3({ metrics }: PageProps) {
  const m = metrics.format;

  return (
    <div className="pg-reports-sample-a4__sheet-inner">
      <header className="pg-reports-sample-a4__head pg-reports-sample-a4__head--compact">
        <span className="pg-reports-sample-a4__mini-brand">Proplytic</span>
        <span className="pg-reports-sample-a4__mini-title">Charts, Notes &amp; Disclaimer</span>
      </header>

      <section className="pg-reports-sample-a4__section">
        <h4>Performance chart preview</h4>
        <div className="pg-reports-sample-a4__split-chart">
          <div className="pg-reports-sample-a4__donut" aria-hidden>
            <span className="pg-reports-sample-a4__donut-hole" />
          </div>
          <ul className="pg-reports-sample-a4__legend">
            <li>
              <i className="pg-reports-sample-a4__legend-swatch pg-reports-sample-a4__legend-swatch--income" />
              Rental income
            </li>
            <li>
              <i className="pg-reports-sample-a4__legend-swatch pg-reports-sample-a4__legend-swatch--opex" />
              Operating expenses
            </li>
            <li>
              <i className="pg-reports-sample-a4__legend-swatch pg-reports-sample-a4__legend-swatch--debt" />
              Debt service
            </li>
          </ul>
        </div>
      </section>

      <section className="pg-reports-sample-a4__section">
        <h4>Projection table preview</h4>
        <table className="pg-reports-sample-a4__table pg-reports-sample-a4__table--dense">
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Income</th>
              <th scope="col">NOI</th>
              <th scope="col">Cash flow</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Y1", "R 319k", "R 254k", "R 110k"],
              ["Y2", "R 338k", "R 268k", "R 118k"],
              ["Y3", "R 358k", "R 284k", "R 126k"]
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="pg-reports-sample-a4__section pg-reports-sample-a4__section--compact">
        <h4>Notes</h4>
        <p className="pg-reports-sample-a4__prose">
          Gross yield {m.grossYield}. Estimated equity {m.estimatedEquity}. Figures are illustrative — signed-in users
          export live data from their workspace.
        </p>
      </section>

      <section className="pg-reports-sample-a4__disclaimer">
        <strong>Disclaimer</strong>
        <p>
          This sample report is for demonstration only. Calculator and report outputs are estimates — verify figures
          before making investment decisions. Proplytic does not provide financial advice.
        </p>
      </section>

      <footer className="pg-reports-sample-a4__footer">Page 3 · Charts, Notes &amp; Disclaimer</footer>
    </div>
  );
}
