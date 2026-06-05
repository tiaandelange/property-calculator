import { AppIcon } from "../../../icons/AppIcon";
import {
  HomeHeroCashFlowLineChart,
  HomeHeroIncomeExpenseBars,
  HomeHeroPortfolioDonutChart
} from "./HomeHeroDashboardCharts";
import {
  HOME_HERO_DASHBOARD_KPIS,
  HOME_HERO_DEMO,
  HOME_HERO_SIDEBAR_NAV
} from "./homeHeroDemoData";

type Props = {
  compact?: boolean;
};

/** Decorative read-only dashboard preview for the marketing homepage hero. */
export function HomeHeroDashboardMockup({ compact = false }: Props) {
  const kpis = compact ? HOME_HERO_DASHBOARD_KPIS.slice(0, 4) : HOME_HERO_DASHBOARD_KPIS;
  const properties = compact ? HOME_HERO_DEMO.topProperties.slice(0, 2) : HOME_HERO_DEMO.topProperties;

  return (
    <div className={`hm-hero-dash${compact ? " hm-hero-dash--compact" : ""}`}>
      <div className="hm-hero-dash__aura" aria-hidden />
      <div className="hm-hero-dash__frame">
        <aside className="hm-hero-dash__sidebar" aria-hidden>
          <div className="hm-hero-dash__brand">
            <img src="/proplytic_logo_600x200_nobg.png" alt="" width={88} height={28} />
          </div>
          <nav className="hm-hero-dash__nav">
            {HOME_HERO_SIDEBAR_NAV.map((item) => (
              <span
                key={item.label}
                className={`hm-hero-dash__nav-item${"active" in item && item.active ? " hm-hero-dash__nav-item--active" : ""}`}
              >
                <AppIcon name={item.icon} size="sm" />
                <span className="hm-hero-dash__nav-label">{item.label}</span>
              </span>
            ))}
          </nav>
        </aside>

        <div className="hm-hero-dash__main">
          <header className="hm-hero-dash__topbar">
            <div>
              <h3 className="hm-hero-dash__title">Portfolio Overview</h3>
              <p className="hm-hero-dash__subtitle">{HOME_HERO_DEMO.propertyCount} properties · Sample data</p>
            </div>
            <div className="hm-hero-dash__topbar-actions">
              <span className="hm-hero-dash__chip">{HOME_HERO_DEMO.period}</span>
              <span className="hm-hero-dash__chip hm-hero-dash__chip--ghost">Filter</span>
              <span className="hm-hero-dash__avatar" aria-hidden>
                <AppIcon name="profile" size="sm" />
              </span>
            </div>
          </header>

          <div className={`hm-hero-dash__kpis hm-hero-dash__kpis--${kpis.length}`}>
            {kpis.map((kpi) => (
              <article
                key={kpi.key}
                className={`hm-hero-dash__kpi${"highlight" in kpi && kpi.highlight ? " hm-hero-dash__kpi--highlight" : ""}`}
              >
                <div className="hm-hero-dash__kpi-head">
                  <span className="hm-hero-dash__kpi-label">{kpi.label}</span>
                  <AppIcon name={kpi.icon} size="sm" />
                </div>
                <strong className="hm-hero-dash__kpi-value">{kpi.value}</strong>
              </article>
            ))}
          </div>

          {!compact ? (
            <div className="hm-hero-dash__charts">
              <article className="hm-hero-dash__panel">
                <div className="hm-hero-dash__panel-head">
                  <h4>Net Cash Flow</h4>
                  <span>6 months</span>
                </div>
                <HomeHeroCashFlowLineChart />
              </article>
              <article className="hm-hero-dash__panel">
                <div className="hm-hero-dash__panel-head">
                  <h4>Portfolio Mix</h4>
                  <span>By type</span>
                </div>
                <div className="hm-hero-dash__donut-wrap">
                  <HomeHeroPortfolioDonutChart />
                  <ul className="hm-hero-dash__mix-legend">
                    {HOME_HERO_DEMO.portfolioMix.map((seg) => (
                      <li key={seg.label}>
                        <span style={{ background: seg.color }} />
                        {seg.label} {seg.pct}%
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
              <article className="hm-hero-dash__panel">
                <div className="hm-hero-dash__panel-head">
                  <h4>Income vs Expenses</h4>
                  <span>Monthly</span>
                </div>
                <HomeHeroIncomeExpenseBars />
              </article>
            </div>
          ) : (
            <article className="hm-hero-dash__panel hm-hero-dash__panel--compact">
              <div className="hm-hero-dash__panel-head">
                <h4>Net Cash Flow</h4>
                <span>6 months</span>
              </div>
              <HomeHeroCashFlowLineChart />
            </article>
          )}

          <div className={`hm-hero-dash__bottom${compact ? " hm-hero-dash__bottom--compact" : ""}`}>
            <article className="hm-hero-dash__panel hm-hero-dash__panel--table">
              <div className="hm-hero-dash__panel-head">
                <h4>Top Properties by Cash Flow</h4>
              </div>
              <div className="hm-hero-dash__table-wrap">
                <table className="hm-hero-dash__table">
                  <thead>
                    <tr>
                      <th scope="col">Property</th>
                      {!compact ? <th scope="col">Type</th> : null}
                      <th scope="col">Net Cash Flow</th>
                      {!compact ? (
                        <>
                          <th scope="col">Yield</th>
                          <th scope="col">Occ.</th>
                          <th scope="col">Value</th>
                        </>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((row) => (
                      <tr key={row.name}>
                        <th scope="row">{row.name}</th>
                        {!compact ? <td>{row.type}</td> : null}
                        <td className="hm-hero-dash__num">{row.cashFlow}</td>
                        {!compact ? (
                          <>
                            <td className="hm-hero-dash__num">{row.yield}</td>
                            <td className="hm-hero-dash__num">{row.occupancy}</td>
                            <td className="hm-hero-dash__num">{row.value}</td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            {!compact ? (
              <article className="hm-hero-dash__panel hm-hero-dash__panel--lease">
                <div className="hm-hero-dash__panel-head">
                  <h4>Lease Expiries</h4>
                  <span>Next {HOME_HERO_DEMO.leaseExpiries.window}</span>
                </div>
                <p className="hm-hero-dash__lease-count">
                  <strong>{HOME_HERO_DEMO.leaseExpiries.count}</strong> leases expiring soon
                </p>
                <ul className="hm-hero-dash__lease-list">
                  <li>Ocean View · 14 Jun</li>
                  <li>Parkline · 28 Jun</li>
                  <li>Riverside · 12 Jul</li>
                </ul>
              </article>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
