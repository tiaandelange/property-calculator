import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, ButtonLink } from "../ui/Button";
import { calculatorRouteForSlug } from "../../data/homepageCalculators";
import { HomeHeroImage } from "../home/HomeHeroImage";
import { Container } from "../ui/Container";
import {
  formatRand,
  HUB_MORTGAGE_PRICE_MAX,
  HUB_MORTGAGE_PRICE_MIN,
  HUB_MORTGAGE_PRICE_STEP,
  monthlyBondRepayment,
  mortgageYearlySeries,
  snapPriceToStep
} from "../../utils/mortgageRepayment";
import { estimatePurchaseOnceOffCosts } from "../../utils/saOnceOffEstimates";

import { UNIVERSAL_DEMO_PROPERTY } from "@calculatorShared/universalDemoProperty";

const DEFAULT_PRICE = UNIVERSAL_DEMO_PROPERTY.purchasePrice;
const DEFAULT_DEPOSIT_PERCENT = Math.round(
  (UNIVERSAL_DEMO_PROPERTY.depositAmount / UNIVERSAL_DEMO_PROPERTY.purchasePrice) * 100
);
const DEFAULT_RATE = UNIVERSAL_DEMO_PROPERTY.annualInterestRatePercent;
const DEFAULT_TERM = UNIVERSAL_DEMO_PROPERTY.loanTermYears;

function parseMoneyInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function HubMortgageChart({
  series,
  termYears
}: {
  series: { year: number; balance: number; totalPaid: number }[];
  termYears: number;
}) {
  const w = 280;
  const h = 120;
  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxY = useMemo(() => {
    const first = series[0];
    const last = series[series.length - 1];
    if (!first || !last) return 1;
    return Math.max(1, first.balance, last.totalPaid);
  }, [series]);

  const xScale = (year: number) => padL + (year / Math.max(termYears, 1)) * innerW;
  const yScale = (v: number) => padT + innerH - (v / maxY) * innerH;

  const balancePath = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.year).toFixed(1)} ${yScale(p.balance).toFixed(1)}`)
    .join(" ");
  const paidPath = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.year).toFixed(1)} ${yScale(p.totalPaid).toFixed(1)}`)
    .join(" ");

  const yTicks = [maxY, maxY / 2, 0].map((v) => ({
    v,
    label: v >= 1_000_000 ? `R${(v / 1_000_000).toFixed(1)}M` : `R${Math.round(v / 1000)}k`
  }));

  return (
    <div className="pg-calc-hub-chart-wrap" aria-hidden="true">
      <div className="pg-calc-hub-chart-y">
        {yTicks.map((t) => (
          <span key={t.label}>{t.label}</span>
        ))}
      </div>
      <svg className="pg-calc-hub-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path
          d={balancePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={paidPath}
          fill="none"
          stroke="rgba(248, 250, 252, 0.82)"
          strokeWidth="2"
          strokeDasharray="6 5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="pg-calc-hub-chart-x">
        <span>0</span>
        <span>{Math.round(termYears / 2)} yrs</span>
        <span>{termYears} yrs</span>
      </div>
    </div>
  );
}

export function CalculatorHubMortgageSection() {
  const [propertyPrice, setPropertyPrice] = useState(DEFAULT_PRICE);
  const [depositPercent, setDepositPercent] = useState(DEFAULT_DEPOSIT_PERCENT);
  const [annualRate, setAnnualRate] = useState(DEFAULT_RATE);
  const [loanTermYears, setLoanTermYears] = useState(DEFAULT_TERM);
  const [priceDraft, setPriceDraft] = useState(() => formatRand(DEFAULT_PRICE).replace(/\s/g, " "));
  const [depositDraft, setDepositDraft] = useState("");

  const depositAmount = useMemo(() => {
    const raw = Math.round((propertyPrice * depositPercent) / 100);
    return Math.min(Math.max(0, raw), Math.max(0, propertyPrice - HUB_MORTGAGE_PRICE_STEP));
  }, [propertyPrice, depositPercent]);

  const loanPrincipal = Math.max(0, propertyPrice - depositAmount);

  const monthly = monthlyBondRepayment(loanPrincipal, annualRate, loanTermYears);
  const nMonths = Math.round(loanTermYears * 12);
  const totalRepayable = monthly * nMonths;
  const totalInterest = Math.max(0, totalRepayable - loanPrincipal);

  const series = useMemo(
    () => mortgageYearlySeries(loanPrincipal, annualRate, loanTermYears),
    [loanPrincipal, annualRate, loanTermYears]
  );

  const onceOff = useMemo(
    () => estimatePurchaseOnceOffCosts(propertyPrice, loanPrincipal),
    [propertyPrice, loanPrincipal]
  );

  const uid = useId().replace(/:/g, "");

  const priceSliderValue = propertyPrice;
  const onPriceSlider = (v: number) => {
    const next = snapPriceToStep(v);
    setPropertyPrice(next);
    setPriceDraft(formatRand(next).replace(/\s/g, " "));
  };

  const syncDepositDraft = () => {
    setDepositDraft(depositAmount ? String(depositAmount) : "");
  };

  // Keep deposit draft in sync when only sliders move
  const depositDisplay = depositDraft !== "" ? depositDraft : String(depositAmount);

  return (
    <div className="pg-calc-hub-dark-band">
      <div className="pg-calc-hub-hero-base" aria-hidden="true" />
      <Container className="pg-container pg-container--marketing-wide pg-calc-hub-dark-band-inner">
        <div className="pg-home-hero-grid pg-calc-hub-hero-grid">
          <div className="pg-home-hero-col--copy">
            <div className="pg-calc-hub-hero-copy-stack">
              <h1 className="pg-calc-hub-hero-title">
                Calculate your monthly <span className="pg-calc-hub-hero-accent">mortgage</span> repayments.
              </h1>
              <p className="pg-calc-hub-hero-lead">
                See what your home loan will cost: monthly instalment, total interest, total repayable and loan amount —
                then open any calculator below for a dedicated page and exports when you sign in.
              </p>
              <ul className="pg-calc-hub-hero-pills" aria-label="Highlights">
                <li>Accurate results</li>
                <li>Adjust anytime</li>
                <li>Plan with confidence</li>
              </ul>
            </div>
          </div>
          <div className="pg-home-hero-col--visual">
            <div className="pg-home-hero-visual">
              <HomeHeroImage
                kind="property"
                alt="Modern home at dusk — estimate bond repayments before you commit"
                className="pg-home-hero-visual-img"
                width={1920}
                height={1080}
                fetchPriority="high"
              />
              <div className="pg-home-hero-image-fade pg-home-hero-image-fade-left" aria-hidden="true" />
              <div className="pg-home-hero-image-fade pg-home-hero-image-fade-bottom" aria-hidden="true" />
              <div className="pg-home-hero-image-fade pg-home-hero-image-fade-top" aria-hidden="true" />
              <aside className="pg-calc-hub-hero-floating" aria-label="Summary preview">
                <div className="pg-calc-hub-hero-floating-label">Monthly repayment</div>
                <div className="pg-calc-hub-hero-floating-value">{formatRand(monthly)}</div>
                <div className="pg-calc-hub-hero-floating-sub">Total repayable {formatRand(totalRepayable)}</div>
                <svg className="pg-calc-hub-hero-spark" viewBox="0 0 120 32" aria-hidden="true">
                  <path
                    d="M0,28 L20,22 40,24 60,14 80,18 100,8 120,4"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </aside>
            </div>
          </div>
        </div>

        <div className="pg-calc-hub-workspace">
          <div className="pg-home-calc-demo-panel pg-calc-hub-inputs-panel" aria-labelledby={`${uid}-inputs`}>
            <div className="pg-home-calc-demo-panel-chrome" id={`${uid}-inputs`}>
              Your details
            </div>
            <div className="pg-home-calc-demo-panel-body pg-calc-hub-panel-body--stretch">
              <div className="pg-home-calc-demo-inputs pg-calc-hub-inputs-col">
                <div className="pg-calc-hub-input-fields">
                <div className="pg-home-calc-demo-field">
                  <span className="pg-home-calc-demo-label">Property price</span>
                  <input
                    className="pg-home-calc-demo-valuebox pg-calc-hub-text-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="Property price in rands"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(e.target.value)}
                    onBlur={() => {
                      const parsed = parseMoneyInput(priceDraft);
                      if (parsed == null) {
                        onPriceSlider(propertyPrice);
                        return;
                      }
                      onPriceSlider(parsed);
                    }}
                  />
                  <input
                    type="range"
                    className="pg-calc-hub-range"
                    min={HUB_MORTGAGE_PRICE_MIN}
                    max={HUB_MORTGAGE_PRICE_MAX}
                    step={HUB_MORTGAGE_PRICE_STEP}
                    value={priceSliderValue}
                    onChange={(e) => onPriceSlider(Number(e.target.value))}
                    aria-valuemin={HUB_MORTGAGE_PRICE_MIN}
                    aria-valuemax={HUB_MORTGAGE_PRICE_MAX}
                  />
                  <div className="pg-calc-hub-range-ticks">
                    <span>{formatRand(HUB_MORTGAGE_PRICE_MIN)}</span>
                    <span>{formatRand(HUB_MORTGAGE_PRICE_MAX)}</span>
                  </div>
                </div>

                <div className="pg-home-calc-demo-field">
                  <div className="pg-calc-hub-deposit-row">
                    <span className="pg-home-calc-demo-label">Deposit</span>
                    <span className="pg-calc-hub-pct-pill">{depositPercent}%</span>
                  </div>
                  <input
                    className="pg-home-calc-demo-valuebox pg-calc-hub-text-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="Deposit amount in rands"
                    value={depositDisplay}
                    onFocus={() => {
                      setDepositDraft(String(depositAmount));
                    }}
                    onChange={(e) => setDepositDraft(e.target.value)}
                    onBlur={() => {
                      const parsed = parseMoneyInput(depositDisplay);
                      if (parsed == null) {
                        syncDepositDraft();
                        return;
                      }
                      const capped = Math.min(Math.max(0, parsed), propertyPrice - 1);
                      const pct = propertyPrice > 0 ? (capped / propertyPrice) * 100 : 0;
                      setDepositPercent(Math.min(50, Math.max(0, Math.round(pct * 10) / 10)));
                      setDepositDraft("");
                    }}
                  />
                  <input
                    type="range"
                    className="pg-calc-hub-range"
                    min={0}
                    max={50}
                    step={0.5}
                    value={depositPercent}
                    onChange={(e) => {
                      setDepositPercent(Number(e.target.value));
                      setDepositDraft("");
                    }}
                  />
                  <div className="pg-calc-hub-range-ticks">
                    <span>0%</span>
                    <span>50%</span>
                  </div>
                </div>

                <div className="pg-home-calc-demo-field pg-home-calc-demo-field--row">
                  <div>
                    <span className="pg-home-calc-demo-label">Interest rate (p.a.)</span>
                    <div className="pg-calc-hub-suffix-wrap">
                      <input
                        className="pg-home-calc-demo-valuebox pg-calc-hub-text-input"
                        type="number"
                        min={1}
                        max={20}
                        step={0.05}
                        value={annualRate}
                        onChange={(e) => {
                          const v = e.target.valueAsNumber;
                          if (!Number.isFinite(v)) return;
                          setAnnualRate(Math.min(20, Math.max(1, v)));
                        }}
                      />
                      <span className="pg-calc-hub-suffix">%</span>
                    </div>
                    <input
                      type="range"
                      className="pg-calc-hub-range"
                      min={1}
                      max={20}
                      step={0.05}
                      value={annualRate}
                      onChange={(e) => setAnnualRate(Number(e.target.value))}
                    />
                    <div className="pg-calc-hub-range-ticks">
                      <span>1%</span>
                      <span>20%</span>
                    </div>
                  </div>
                  <div>
                    <span className="pg-home-calc-demo-label">Loan term</span>
                    <div className="pg-home-calc-demo-valuebox pg-calc-hub-readonly">{loanTermYears} years</div>
                    <input
                      type="range"
                      className="pg-calc-hub-range"
                      min={5}
                      max={30}
                      step={1}
                      value={loanTermYears}
                      onChange={(e) => setLoanTermYears(Number(e.target.value))}
                    />
                    <div className="pg-calc-hub-range-ticks">
                      <span>5 years</span>
                      <span>30 years</span>
                    </div>
                  </div>
                </div>
                </div>

                <div className="pg-calc-hub-actions pg-calc-hub-actions--panel-footer">
                  <ButtonLink
                    href={calculatorRouteForSlug("monthly-payment")}
                    variant="primary"
                    className="pg-calc-hub-primary-btn"
                  >
                    Open full bond calculator
                  </ButtonLink>
                  <Button
                    type="button"
                    variant="soft"
                    className="pg-calc-hub-reset"
                    onClick={() => {
                      setPropertyPrice(DEFAULT_PRICE);
                      setDepositPercent(DEFAULT_DEPOSIT_PERCENT);
                      setAnnualRate(DEFAULT_RATE);
                      setLoanTermYears(DEFAULT_TERM);
                      setPriceDraft(formatRand(DEFAULT_PRICE).replace(/\s/g, " "));
                      setDepositDraft("");
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="pg-home-calc-demo-panel pg-calc-hub-results-panel" aria-labelledby={`${uid}-results`}>
            <div className="pg-home-calc-demo-panel-chrome" id={`${uid}-results`}>
              Your results
            </div>
            <div className="pg-home-calc-demo-panel-body pg-calc-hub-panel-body--stretch">
              <div className="pg-calc-hub-results-stack">
                <div className="pg-calc-hub-metric-grid">
                  <div className="pg-calc-hub-metric pg-calc-hub-metric--accent">
                    <span className="pg-calc-hub-metric-label">Monthly repayment</span>
                    <span className="pg-calc-hub-metric-value">{formatRand(monthly)}</span>
                  </div>
                  <div className="pg-calc-hub-metric">
                    <span className="pg-calc-hub-metric-label">Total interest payable</span>
                    <span className="pg-calc-hub-metric-value">{formatRand(totalInterest)}</span>
                  </div>
                  <div className="pg-calc-hub-metric">
                    <span className="pg-calc-hub-metric-label">Total repayable</span>
                    <span className="pg-calc-hub-metric-value">{formatRand(totalRepayable)}</span>
                  </div>
                  <div className="pg-calc-hub-metric">
                    <span className="pg-calc-hub-metric-label">Loan amount</span>
                    <span className="pg-calc-hub-metric-value">{formatRand(loanPrincipal)}</span>
                  </div>
                  <div className="pg-calc-hub-metric pg-calc-hub-metric--onceoff pg-calc-hub-metric--fullwidth">
                    <span className="pg-calc-hub-metric-label">Once off costs</span>
                    <span className="pg-calc-hub-metric-value">{formatRand(onceOff.totalOnceOff)}</span>
                    <sub className="pg-calc-hub-onceoff-sub">
                      Bond registration cost {formatRand(onceOff.bondRegistrationCost)} · Transfer cost{" "}
                      {formatRand(onceOff.transferCost)}
                    </sub>
                  </div>
                </div>

                <div className="pg-calc-hub-chart-block pg-calc-hub-chart-block--grow">
                  <div className="pg-calc-hub-chart-legend">
                    <span className="pg-calc-hub-legend-line pg-calc-hub-legend-line--solid">Outstanding balance</span>
                    <span className="pg-calc-hub-legend-line pg-calc-hub-legend-line--dash">Total paid</span>
                  </div>
                  <HubMortgageChart series={series} termYears={loanTermYears} />
                </div>
              </div>

              <p className="pg-calc-hub-disclaimer pg-calc-hub-disclaimer--panel-footer">
                Indicative only — bond, transfer and amortisation figures are estimates (same fee model as the transfer
                calculator). Does not include insurance or rate changes.{" "}
                <Link to={calculatorRouteForSlug("transfer-bond-costs")}>Full transfer &amp; bond costs</Link>.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
