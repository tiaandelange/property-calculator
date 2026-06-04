import {
  homepagePreviewCalculator,
  homepagePreviewInvoice,
  homepagePreviewManagement,
  homepagePreviewPortfolio,
  homepagePreviewProperty,
  homepagePreviewReport,
  homepagePreviewStatement
} from "../../../data/homepagePreviewContent";
import type { PreviewMetric } from "../../../data/homepagePreviewContent";
import { HomeMarketingHeroPropertyBondChart } from "./HomeMarketingHeroPropertyBondChart";
import { PreviewMetricIcon } from "./homeMarketingPreviewMetricIcon";
import { HomeMarketingPreviewModuleLabel, HomeMarketingPreviewShell } from "./HomeMarketingPreviewShell";

function PreviewMetrics({
  metrics,
  columns = 2,
  heroCube = false
}: {
  metrics: readonly PreviewMetric[];
  columns?: 2 | 4;
  heroCube?: boolean;
}) {
  const metricsClass = [
    "hm-app-preview__metrics",
    columns === 4 || heroCube ? "hm-app-preview__metrics--4" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={metricsClass}>
      {metrics.map((metric) => (
        <article
          key={metric.label}
          className={`hm-app-preview__metric${metric.highlight ? " hm-app-preview__metric--highlight" : ""}`}
        >
          <div className="hm-app-preview__metric-top">
            <div className="hm-app-preview__metric-copy">
              <p className="hm-app-preview__metric-label">{metric.label}</p>
              <p className="hm-app-preview__metric-value">{metric.value}</p>
            </div>
            <PreviewMetricIcon label={metric.label} icon={metric.icon} />
          </div>
          {metric.change ? (
            <p className={`hm-app-preview__metric-change hm-app-preview__metric-change--${metric.changeTone ?? "neutral"}`}>
              {metric.change}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ChartBars({
  values,
  months,
  height = 88
}: {
  values: readonly number[];
  months?: readonly string[];
  height?: number;
}) {
  const max = Math.max(...values);
  return (
    <div className="hm-app-preview__chart-wrap">
      <div className="hm-app-preview__chart-bars" style={{ height }} aria-hidden>
        {values.map((value, index) => (
          <span
            key={index}
            className="hm-app-preview__chart-bar"
            style={{ height: `${Math.round((value / max) * 100)}%` }}
          />
        ))}
      </div>
      {months ? (
        <div className="hm-app-preview__chart-axis" aria-hidden>
          {months.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Paid" || status === "Active" || status === "Let"
      ? "success"
      : status.includes("Overdue")
        ? "danger"
        : "warning";
  return <span className={`hm-preview-badge hm-preview-badge--${tone}`}>{status}</span>;
}

export function HomeMarketingPortfolioPreview({
  showLabel = true,
  heroCube = false
}: {
  showLabel?: boolean;
  heroCube?: boolean;
}) {
  const data = homepagePreviewPortfolio;

  return (
    <div
      className={[
        "hm-module-preview hm-module-preview--portfolio",
        heroCube ? "hm-app-preview--hero-cube" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showLabel ? <HomeMarketingPreviewModuleLabel>{data.moduleLabel}</HomeMarketingPreviewModuleLabel> : null}
      <HomeMarketingPreviewShell crumbs={data.crumbs} chips={data.chips} activeNav={0} compact dense>
        <PreviewMetrics metrics={data.metrics} heroCube={heroCube} />
        <div className="hm-app-preview__split">
          <section className="hm-app-preview__panel hm-app-preview__panel--chart">
            <div className="hm-app-preview__panel-head">
              <h3 className="hm-app-preview__panel-title">{data.chart.title}</h3>
              <span className="hm-app-preview__panel-meta">{data.chart.meta}</span>
            </div>
            <ChartBars values={data.chart.values} months={data.chart.months} />
          </section>
          <section className="hm-app-preview__panel">
            <div className="hm-app-preview__panel-head">
              <h3 className="hm-app-preview__panel-title">Top properties</h3>
              <span className="hm-app-preview__panel-meta">Net cash flow</span>
            </div>
            <table className="hm-app-preview__table">
              <thead>
                <tr>
                  <th scope="col">Property</th>
                  <th scope="col">Cash flow</th>
                  <th scope="col">Yield</th>
                </tr>
              </thead>
              <tbody>
                {data.properties.map((row) => (
                  <tr key={row.name}>
                    <td>
                      <span className="hm-app-preview__property-name">{row.name}</span>
                      <span className="hm-app-preview__property-sub">{row.suburb}</span>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>{row.cashFlow}</td>
                    <td>{row.yield}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </HomeMarketingPreviewShell>
    </div>
  );
}

export function HomeMarketingPropertyPreview({
  showLabel = true,
  heroCube = false
}: {
  showLabel?: boolean;
  heroCube?: boolean;
}) {
  const data = homepagePreviewProperty;

  return (
    <div
      className={[
        "hm-module-preview hm-module-preview--property",
        heroCube ? "hm-app-preview--hero-cube" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showLabel ? <HomeMarketingPreviewModuleLabel>{data.moduleLabel}</HomeMarketingPreviewModuleLabel> : null}
      <HomeMarketingPreviewShell crumbs={data.crumbs} chips={data.chips} activeNav={1} compact dense>
        <div className="hm-preview-property-head">
          <div>
            <h3 className="hm-preview-property-head__title">{data.headline}</h3>
            <p className="hm-preview-property-head__address">{data.address}</p>
          </div>
          <StatusBadge status={data.lease.status} />
        </div>
        <PreviewMetrics metrics={data.metrics} columns={heroCube ? 2 : 4} heroCube={heroCube} />
        {heroCube ? (
          <HomeMarketingHeroPropertyBondChart />
        ) : (
          <div className="hm-app-preview__split hm-app-preview__split--property">
            <section className="hm-app-preview__panel">
              <div className="hm-app-preview__panel-head">
                <h3 className="hm-app-preview__panel-title">Active lease</h3>
              </div>
              <dl className="hm-preview-dl">
                <div>
                  <dt>Tenant</dt>
                  <dd>{data.lease.tenant}</dd>
                </div>
                <div>
                  <dt>Rent</dt>
                  <dd>{data.lease.rent}</dd>
                </div>
                <div>
                  <dt>Term</dt>
                  <dd>{data.lease.term}</dd>
                </div>
              </dl>
            </section>
            <section className="hm-app-preview__panel">
              <div className="hm-app-preview__panel-head">
                <h3 className="hm-app-preview__panel-title">Monthly expenses</h3>
              </div>
              <ul className="hm-preview-line-list">
                {data.expenses.map((row) => (
                  <li key={row.label}>
                    <span>{row.label}</span>
                    <span>{row.amount}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </HomeMarketingPreviewShell>
    </div>
  );
}

export function HomeMarketingStatementPreview({ showLabel = true }: { showLabel?: boolean }) {
  const data = homepagePreviewStatement;

  return (
    <div className="hm-module-preview hm-module-preview--statement">
      {showLabel ? <HomeMarketingPreviewModuleLabel>{data.moduleLabel}</HomeMarketingPreviewModuleLabel> : null}
      <HomeMarketingPreviewShell crumbs={data.crumbs} chips={data.chips} activeNav={4} compact dense>
        <div className="hm-preview-statement-head">
          <div>
            <p className="hm-preview-statement-head__tenant">{data.tenant}</p>
            <p className="hm-preview-statement-head__period">{data.period}</p>
          </div>
          <div className="hm-preview-statement-head__balances">
            <span>
              Opening <strong>{data.opening}</strong>
            </span>
            <span>
              Closing <strong>{data.closing}</strong>
            </span>
          </div>
        </div>
        <div className="hm-preview-data-table-wrap">
          <table className="hm-preview-data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.date + row.description}>
                  <td>{row.date}</td>
                  <td>
                    <span className="hm-preview-type-pill">{row.type}</span>
                  </td>
                  <td>{row.description}</td>
                  <td className="hm-preview-num">{row.debit || "—"}</td>
                  <td className="hm-preview-num hm-preview-num--credit">{row.credit || "—"}</td>
                  <td className="hm-preview-num">{row.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HomeMarketingPreviewShell>
    </div>
  );
}

export function HomeMarketingInvoicePreview({ showLabel = true, listOnly }: { showLabel?: boolean; listOnly?: boolean }) {
  const data = homepagePreviewInvoice;

  if (listOnly) {
    return (
      <div className="hm-module-preview hm-module-preview--invoice-list">
        {showLabel ? <HomeMarketingPreviewModuleLabel>{data.moduleLabel}</HomeMarketingPreviewModuleLabel> : null}
        <HomeMarketingPreviewShell crumbs={data.crumbs} chips={data.chips} activeNav={3} compact dense>
          <table className="hm-app-preview__table hm-app-preview__table--invoices">
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Tenant</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.list.map((row) => (
                <tr key={row.number}>
                  <td className="hm-preview-invoice-num">{row.number}</td>
                  <td>{row.tenant}</td>
                  <td>{row.amount}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HomeMarketingPreviewShell>
      </div>
    );
  }

  return (
    <div className="hm-module-preview hm-module-preview--invoice">
      {showLabel ? <HomeMarketingPreviewModuleLabel>{data.moduleLabel}</HomeMarketingPreviewModuleLabel> : null}
      <HomeMarketingPreviewShell crumbs={data.crumbs} chips={data.chips} activeNav={3} compact dense>
        <article className="hm-preview-invoice-doc">
          <header className="hm-preview-invoice-doc__head">
            <div>
              <p className="hm-preview-invoice-doc__number">{data.document.number}</p>
              <p className="hm-preview-invoice-doc__meta">
                {data.document.tenant} · {data.document.property}
              </p>
            </div>
            <StatusBadge status={data.document.status} />
          </header>
          <p className="hm-preview-invoice-doc__dates">
            Issued {data.document.issued} · Due {data.document.due}
          </p>
          <table className="hm-preview-invoice-lines">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.description}>
                  <td>{line.description}</td>
                  <td>{line.qty}</td>
                  <td>{line.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className="hm-preview-invoice-doc__total">
            <span>Total due</span>
            <strong>{data.total}</strong>
          </footer>
        </article>
      </HomeMarketingPreviewShell>
    </div>
  );
}

export function HomeMarketingCalculatorPreview({ showLabel = true }: { showLabel?: boolean }) {
  const data = homepagePreviewCalculator;

  return (
    <div className="hm-module-preview hm-module-preview--calculator">
      {showLabel ? <HomeMarketingPreviewModuleLabel>{data.moduleLabel}</HomeMarketingPreviewModuleLabel> : null}
      <HomeMarketingPreviewShell crumbs={data.crumbs} activeNav={6} compact dense>
        <div className="hm-preview-calc">
          <h3 className="hm-preview-calc__title">{data.title}</h3>
          <div className="hm-preview-calc__grid">
            <div className="hm-preview-calc__inputs">
              {data.inputs.map((field) => (
                <label key={field.label} className="hm-preview-calc__field">
                  <span className="hm-preview-calc__field-label">{field.label}</span>
                  <span className="hm-preview-calc__field-value">{field.value}</span>
                </label>
              ))}
            </div>
            <div className="hm-preview-calc__result">
              <p className="hm-preview-calc__result-label">{data.result.label}</p>
              <p className="hm-preview-calc__result-value">{data.result.value}</p>
              <p className="hm-preview-calc__result-note">{data.result.note}</p>
              <ul className="hm-preview-calc__breakdown">
                {data.breakdown.map((row) => (
                  <li key={row.label}>
                    <span>{row.label}</span>
                    <span>{row.value}</span>
                  </li>
                ))}
              </ul>
              <ChartBars values={data.chart.values} height={56} />
            </div>
          </div>
        </div>
      </HomeMarketingPreviewShell>
    </div>
  );
}

export function HomeMarketingLeasePreview({ showLabel = true }: { showLabel?: boolean }) {
  const lease = homepagePreviewManagement.lease;

  return (
    <div className="hm-module-preview hm-module-preview--lease">
      {showLabel ? <HomeMarketingPreviewModuleLabel>{lease.moduleLabel}</HomeMarketingPreviewModuleLabel> : null}
      <HomeMarketingPreviewShell crumbs={["Properties", lease.property]} activeNav={2} compact dense>
        <article className="hm-preview-lease-card">
          <header className="hm-preview-lease-card__head">
            <div>
              <p className="hm-preview-lease-card__property">{lease.property}</p>
              <p className="hm-preview-lease-card__tenant">{lease.tenant}</p>
            </div>
            <StatusBadge status={lease.status} />
          </header>
          <dl className="hm-preview-dl hm-preview-dl--lease">
            <div>
              <dt>Monthly rent</dt>
              <dd>{lease.rent}</dd>
            </div>
            <div>
              <dt>Deposit held</dt>
              <dd>{lease.deposit}</dd>
            </div>
            <div>
              <dt>Lease start</dt>
              <dd>{lease.start}</dd>
            </div>
            <div>
              <dt>Lease end</dt>
              <dd>{lease.end}</dd>
            </div>
          </dl>
        </article>
      </HomeMarketingPreviewShell>
    </div>
  );
}
