import { homepagePreviewReport } from "../../../data/homepagePreviewContent";

/** Static marketing illustration — no PDF generation or API calls. */
export function HomeMarketingReportPreviewMock({ showCaption = false }: { showCaption?: boolean }) {
  const report = homepagePreviewReport;
  const maxBar = Math.max(...report.chartBars);

  return (
    <div
      className="hm-report-preview"
      role="img"
      aria-label="Illustrative Proplytic investment report export with metrics, projections table and cash flow chart"
    >
      <div className="hm-report-preview__workspace">
        <div className="hm-report-preview__toolbar">
          <span className="hm-report-preview__toolbar-title">Investment report</span>
          <div className="hm-report-preview__toolbar-actions" aria-hidden>
            <span className="hm-report-preview__toolbar-btn">Preview</span>
            <span className="hm-report-preview__toolbar-btn hm-report-preview__toolbar-btn--primary">
              Export PDF
            </span>
          </div>
        </div>

        <nav className="hm-report-preview__tabs" aria-hidden>
          {report.sections.map((section, index) => (
            <span
              key={section}
              className={`hm-report-preview__tab${index === 0 ? " hm-report-preview__tab--active" : ""}`}
            >
              {section}
            </span>
          ))}
        </nav>

        <div className="hm-report-preview__page">
          <div className="hm-report-preview__header">
            <div>
              <span className="hm-report-preview__header-title">{report.headerTitle}</span>
              <span className="hm-report-preview__header-meta">{report.propertyLine}</span>
            </div>
            <span className="hm-report-preview__header-date">{report.generated}</span>
          </div>

          <p className="hm-report-preview__disclaimer">{report.disclaimer}</p>

          <div className="hm-report-preview__metrics">
            {report.metrics.map((m) => (
              <div key={m.label} className="hm-report-preview__metric">
                <span className="hm-report-preview__metric-label">{m.label}</span>
                <span className="hm-report-preview__metric-value">{m.value}</span>
              </div>
            ))}
          </div>

          <div className="hm-report-preview__rules">
            {report.rules.map((rule) => (
              <div key={rule.label} className="hm-report-preview__rule">
                <span className="hm-report-preview__rule-label">{rule.label}</span>
                <span className="hm-report-preview__rule-value">{rule.value}</span>
              </div>
            ))}
          </div>

          <div className="hm-report-preview__body-split">
            <div className="hm-report-preview__table-wrap">
              <span className="hm-report-preview__table-caption">{report.table.caption}</span>
              <table className="hm-report-preview__table">
                <thead>
                  <tr>
                    {report.table.headers.map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.table.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell) => (
                        <td key={cell}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hm-report-preview__chart">
              <span className="hm-report-preview__chart-caption">{report.chartCaption}</span>
              <div className="hm-report-preview__bars">
                {report.chartBars.map((h, i) => (
                  <span
                    key={i}
                    className="hm-report-preview__bar"
                    style={{ height: `${Math.round((h / maxBar) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="hm-report-preview__chart-legend" aria-hidden>
                <span>
                  <i className="hm-report-preview__legend-dot hm-report-preview__legend-dot--proj" />
                  Projected
                </span>
                <span>
                  <i className="hm-report-preview__legend-dot hm-report-preview__legend-dot--actual" />
                  Actual
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showCaption ? (
        <p className="hm-module-preview__label hm-module-preview__label--below">{report.moduleLabel}</p>
      ) : null}
    </div>
  );
}
