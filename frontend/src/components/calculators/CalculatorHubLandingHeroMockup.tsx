import { IconContainerByName } from "../icons";

const KEYPAD_ROWS = [
  ["AC", "±", "%", "÷"],
  ["7", "8", "9", "+"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "="]
] as const;

const FLOATING_TILES = [
  { icon: "percent" as const, className: "pg-calc-hub-landing-hero__float-tile--pct" },
  { icon: "income" as const, className: "pg-calc-hub-landing-hero__float-tile--chart" },
  { icon: "reports" as const, className: "pg-calc-hub-landing-hero__float-tile--pie" },
  { icon: "property" as const, className: "pg-calc-hub-landing-hero__float-tile--home" }
] as const;

/** Decorative cash-flow calculator card (not interactive). */
export function CalculatorHubLandingHeroMockup() {
  return (
    <div className="pg-calc-hub-landing-hero__visual" aria-hidden>
      {FLOATING_TILES.map((tile) => (
        <span key={tile.className} className={`pg-calc-hub-landing-hero__float-tile ${tile.className}`}>
          <IconContainerByName icon={tile.icon} accent="purple" size="sm" />
        </span>
      ))}
      <div className="pg-calc-hub-landing-hero__mockup-wrap">
        <article className="pg-calc-hub-landing-hero__mockup">
          <header className="pg-calc-hub-landing-hero__mockup-head">
            <IconContainerByName icon="wallet" accent="purple" size="sm" />
            <span className="pg-calc-hub-landing-hero__mockup-title">Cash Flow</span>
            <span className="pg-calc-hub-landing-hero__mockup-badge">+ 8.2%</span>
          </header>
          <p className="pg-calc-hub-landing-hero__mockup-hero-value">
            R 41,200 <span className="pg-calc-hub-landing-hero__mockup-hero-unit">/mo</span>
          </p>
          <dl className="pg-calc-hub-landing-hero__mockup-rows">
            <div>
              <dt>Gross Rental Income</dt>
              <dd>R 68,000</dd>
            </div>
            <div>
              <dt>Operating Expenses</dt>
              <dd>R 14,800</dd>
            </div>
            <div>
              <dt>Debt Service</dt>
              <dd>R 12,000</dd>
            </div>
          </dl>
          <div className="pg-calc-hub-landing-hero__mockup-net">
            <span>Net Cash Flow</span>
            <strong>R 41,200</strong>
          </div>
          <div className="pg-calc-hub-landing-hero__mockup-keypad" role="presentation">
            {KEYPAD_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="pg-calc-hub-landing-hero__mockup-keypad-row">
                {row.map((key) => (
                  <span
                    key={key}
                    className={
                      key === "="
                        ? "pg-calc-hub-landing-hero__mockup-key pg-calc-hub-landing-hero__mockup-key--equals"
                        : "pg-calc-hub-landing-hero__mockup-key"
                    }
                  >
                    {key}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
