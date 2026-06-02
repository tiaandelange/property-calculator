import { homepageReportsPreviewMock } from "../../../data/homepageMarketingContent";

/** Static marketing illustration — no PDF generation or API calls. */
export function HomeMarketingReportPreviewMock() {
  const mock = homepageReportsPreviewMock;

  return (
    <div
      className="hm-report-preview"
      role="img"
      aria-label="Illustrative PDF report preview with sample metrics, table and chart"
    >
      <div className="hm-report-preview__page">
        <div className="hm-report-preview__header">
          <span className="hm-report-preview__header-title">{mock.headerTitle}</span>
          <span className="hm-report-preview__header-meta">{mock.propertyLine}</span>
        </div>

        <p className="hm-report-preview__disclaimer">{mock.disclaimer}</p>

        <div className="hm-report-preview__metrics">
          {mock.metrics.map((m) => (
            <div key={m.label} className="hm-report-preview__metric">
              <span className="hm-report-preview__metric-label">{m.label}</span>
              <span className="hm-report-preview__metric-value">{m.value}</span>
            </div>
          ))}
        </div>

        <div className="hm-report-preview__table-wrap">
          <span className="hm-report-preview__table-caption">{mock.table.caption}</span>
          <table className="hm-report-preview__table">
            <thead>
              <tr>
                {mock.table.headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mock.table.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell) => (
                    <td key={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="hm-report-preview__chart" aria-hidden>
          <span className="hm-report-preview__chart-caption">{mock.chartCaption}</span>
          <div className="hm-report-preview__bars">
            {mock.chartBars.map((h, i) => (
              <span key={i} className="hm-report-preview__bar" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
