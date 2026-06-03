/** Static marketing dashboard preview — no live data. */
export function LoginDashboardPreview() {
  const bars = [42, 58, 48, 72, 64, 80, 68, 76, 62, 88, 74, 92];

  return (
    <div className="pg-login-preview" aria-hidden="true">
      <div className="pg-login-preview__shell">
        <div className="pg-login-preview__rail">
          <span className="pg-login-preview__rail-item pg-login-preview__rail-item--active" />
          <span className="pg-login-preview__rail-item" />
          <span className="pg-login-preview__rail-item" />
          <span className="pg-login-preview__rail-item" />
          <span className="pg-login-preview__rail-item" />
        </div>
        <div className="pg-login-preview__main">
          <div className="pg-login-preview__metrics">
            <div className="pg-login-preview__metric">
              <span className="pg-login-preview__metric-label">Total Equity</span>
              <strong>R 4.82M</strong>
            </div>
            <div className="pg-login-preview__metric">
              <span className="pg-login-preview__metric-label">Net Cash Flow</span>
              <strong>R 41,200</strong>
            </div>
            <div className="pg-login-preview__metric">
              <span className="pg-login-preview__metric-label">Portfolio Yield</span>
              <strong>9.4%</strong>
            </div>
          </div>

          <div className="pg-login-preview__chart">
            <p className="pg-login-preview__chart-title">Net cash flow · 12 months</p>
            <div className="pg-login-preview__bars">
              {bars.map((h, i) => (
                <span key={i} className="pg-login-preview__bar" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          <div className="pg-login-preview__table">
            <p className="pg-login-preview__table-title">Top properties</p>
            <table>
              <tbody>
                <tr>
                  <th scope="row">Oak Street Duplex</th>
                  <td>R 12,400</td>
                </tr>
                <tr>
                  <th scope="row">Riverside Flat</th>
                  <td>R 8,900</td>
                </tr>
                <tr>
                  <th scope="row">Parkview Unit 3</th>
                  <td>R 6,200</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
