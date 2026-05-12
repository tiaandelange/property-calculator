import { solveIrrPeriodicCashFlows } from "../../utils/irrSolver.js";
import { leaseDisplayStatus, isCurrentLeaseStatus } from "./propertyLease.helpers.js";
import {
  ALLOWED_BOND_TERM_YEARS,
  amortizingMonthlyPayment,
  inferMonthlyBondPaymentForExpenseBaseline,
  resolveBondRemainingMonths
} from "./property.bond.helpers.js";

export type PortfolioProjectionGrowth = {
  rentalIncomeGrowthPercentAnnual: number;
  totalExpensesGrowthPercentAnnual: number;
};

function numMoney(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function monthlyLeaseRentTotal(property: any): number {
  const currentLeases = (property.leases ?? []).filter((l: any) =>
    isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))
  );
  return currentLeases.reduce((s: number, l: any) => s + Number(l.monthlyRent ?? 0), 0);
}

/** STR net monthly income from property field assumptions (aligned with dashboard / IRR). */
export function monthlyStrNetForProperty(property: any): number {
  if (property.investmentType !== "SHORT_TERM_RENTAL") return 0;
  const adr = property.averageDailyRate ?? 0;
  const occ = property.occupancyRate ?? 0;
  const nights = property.availableNightsPerMonth ?? 0;
  const gross = adr * occ * nights;
  const platformFee = (property.platformFeePercent ?? 0) / 100;
  const mgmtFee = (property.managementFeePercent ?? 0) / 100;
  return gross * (1 - platformFee) - gross * mgmtFee + Number(property.cleaningFeesMonthly ?? 0);
}

export type PortfolioIrrOperatingBaseline =
  | "EXPECTED_MONTHLY"
  | "STATEMENT_LEDGER_AVG"
  /** Trailing‑12 income + invoices, but rental income raised to current contractual lease when ledger lags. */
  | "STATEMENT_LEDGER_LEASE_INCOME_FLOOR"
  | "MODELED_FALLBACK";

export type StatementMonthlyIrrAverage = {
  avgMonthlyIncome: number;
  avgMonthlyExpenseTotal: number;
  /** True when avgMonthlyIncome was set to max(statement, contractual lease rent). */
  leaseIncomeFloorApplied?: boolean;
};

/** Single-property operating baseline (Year 1 monthly) — same rules as portfolio projection IRR. */
export function computePropertyOperatingBaselineForProjection(params: {
  property: any;
  statementMonthlyAverageByProperty: Map<number, StatementMonthlyIrrAverage>;
  currentMonthStatementIncomeByProperty: Map<number, number>;
  expenseMonthByProperty: Map<number, any[]>;
  projectionAsOf: Date;
}): {
  baseMonthlyIncome: number;
  baseMonthlyExpenseTotal: number;
  operatingBaseline: PortfolioIrrOperatingBaseline;
} {
  const { property: p, statementMonthlyAverageByProperty, currentMonthStatementIncomeByProperty, expenseMonthByProperty, projectionAsOf } =
    params;
  const stmtAvg = statementMonthlyAverageByProperty.get(p.id);

  const incExplicit = numMoney(p.expectedMonthlyIncome);
  const expExplicit = numMoney(p.expectedMonthlyExpenses);

  let operatingBaseline: PortfolioIrrOperatingBaseline;
  let baseMonthlyIncome: number;
  let baseMonthlyExpenseTotal: number;

  if (incExplicit != null && expExplicit != null) {
    baseMonthlyIncome = incExplicit;
    baseMonthlyExpenseTotal = expExplicit;
    operatingBaseline = "EXPECTED_MONTHLY";
  } else {
    baseMonthlyIncome = stmtAvg?.avgMonthlyIncome ?? 0;
    if (baseMonthlyIncome <= 0) {
      baseMonthlyIncome = currentMonthStatementIncomeByProperty.get(p.id) ?? 0;
    }
    if (baseMonthlyIncome <= 0) {
      baseMonthlyIncome = monthlyLeaseRentTotal(p) + monthlyStrNetForProperty(p);
    }

    const expRows = expenseMonthByProperty.get(p.id) ?? [];
    let opEx = expRows.filter((e: any) => e.category !== "BOND_PAYMENT").reduce((a: number, r: any) => a + r.amount, 0);
    let debt = expRows.filter((e: any) => e.category === "BOND_PAYMENT").reduce((a: number, r: any) => a + r.amount, 0);
    const bondProf = numMoney(p.monthlyBondPayment) ?? 0;
    const inferredBond = inferMonthlyBondPaymentForExpenseBaseline(p, projectionAsOf);
    const inferredDebt = inferredBond?.monthlyPayment ?? 0;
    debt = Math.max(debt, bondProf, inferredDebt);

    baseMonthlyExpenseTotal = stmtAvg?.avgMonthlyExpenseTotal ?? 0;
    if (baseMonthlyExpenseTotal <= 0) {
      baseMonthlyExpenseTotal = opEx + debt;
    }

    if (stmtAvg?.leaseIncomeFloorApplied) {
      operatingBaseline = "STATEMENT_LEDGER_LEASE_INCOME_FLOOR";
    } else {
      operatingBaseline =
        (stmtAvg?.avgMonthlyIncome ?? 0) > 0 || (stmtAvg?.avgMonthlyExpenseTotal ?? 0) > 0 ? "STATEMENT_LEDGER_AVG" : "MODELED_FALLBACK";
    }
  }

  return { baseMonthlyIncome, baseMonthlyExpenseTotal, operatingBaseline };
}

/** Outstanding bond balance after `horizonMonths` of fixed instalments from `asOf`, when rate + payment allow amortisation. */
export function projectBondBalanceAtHorizon(
  property: any,
  horizonMonths: number,
  asOf: Date
): { balance: number; amortized: boolean } {
  const balance0 = numMoney(property.outstandingBondBalance) ?? 0;
  const months = Math.max(0, Math.floor(horizonMonths));
  if (balance0 <= 0 || months <= 0) return { balance: Math.max(0, balance0), amortized: false };

  const rateAnnual = numMoney(property.bondAnnualInterestRatePercent);
  if (rateAnnual == null || rateAnnual <= 0) return { balance: balance0, amortized: false };

  const resolved = resolveBondRemainingMonths(property, asOf);
  const remainingAtStart =
    resolved.remainingMonths != null && resolved.remainingMonths > 0 ? resolved.remainingMonths : Math.max(months, 1);

  let payment = numMoney(property.monthlyBondPayment);
  if ((payment == null || payment <= 0) && remainingAtStart > 0) {
    payment = amortizingMonthlyPayment(balance0, rateAnnual, remainingAtStart);
  }
  if (payment == null || payment <= 0) return { balance: balance0, amortized: false };

  const i = rateAnnual / 100 / 12;
  let bal = balance0;
  for (let m = 0; m < months && bal > 1e-9; m++) {
    const interest = bal * i;
    let principal = payment - interest;
    if (principal < 0) principal = 0;
    if (principal > bal) principal = bal;
    bal -= principal;
  }
  return { balance: Math.max(0, bal), amortized: true };
}

const ANALYSIS_TABLE_MAX_YEARS = Math.max(...ALLOWED_BOND_TERM_YEARS);

/** Milestone projection years; actual columns are filtered to the bond-schedule ceiling (then 30 default). */
export const PORTFOLIO_ANALYSIS_TABLE_PRESET_YEARS = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30] as const;

/** @deprecated Use {@link PORTFOLIO_ANALYSIS_TABLE_PRESET_YEARS}; horizons are now capped by bond payoff. */
export const PORTFOLIO_ANALYSIS_OVER_TIME_YEARS = PORTFOLIO_ANALYSIS_TABLE_PRESET_YEARS;

/**
 * Longest remaining bond schedule in the portfolio (years, ceiling on months ÷ 12).
 * Properties with no bond or no resolvable remaining term do not extend the window.
 * When no mortgaged property yields a schedule, returns `capYears: 30` and `limitedByBondSchedule: false`.
 */
export function portfolioBondScheduleHorizonYearsCeiling(
  properties: any[],
  asOf: Date
): { capYears: number; limitedByBondSchedule: boolean } {
  let maxYears = 0;
  let anyBondWithSchedule = false;
  for (const p of properties as any[]) {
    const bal = numMoney(p.outstandingBondBalance) ?? 0;
    if (bal <= 0) continue;
    const r = resolveBondRemainingMonths(p, asOf);
    if (r.remainingMonths != null && r.remainingMonths > 0) {
      anyBondWithSchedule = true;
      const yrs = Math.ceil(r.remainingMonths / 12);
      if (yrs > maxYears) maxYears = yrs;
    }
  }
  if (!anyBondWithSchedule) {
    return { capYears: ANALYSIS_TABLE_MAX_YEARS, limitedByBondSchedule: false };
  }
  return {
    capYears: Math.min(ANALYSIS_TABLE_MAX_YEARS, Math.max(1, maxYears)),
    limitedByBondSchedule: true
  };
}

export function buildPortfolioAnalysisHorizonYears(ceilingYears: number): number[] {
  const cap = Math.max(1, Math.min(ANALYSIS_TABLE_MAX_YEARS, Math.ceil(ceilingYears)));
  const preset = PORTFOLIO_ANALYSIS_TABLE_PRESET_YEARS.filter((y) => y <= cap);
  const out = new Set<number>(preset);
  out.add(cap);
  return Array.from(out).sort((a, b) => a - b);
}

function parsePurchaseDate(p: any): Date | null {
  const raw = p?.purchaseDate;
  if (raw == null || raw === "") return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 1-indexed calendar ownership year from purchase month → dashboard month (inclusive).
 * Example: bought June 2022, dashboard May 2026 → year 4.
 */
export function ownershipYearFromPurchase(purchaseDate: Date, asOf: Date): number {
  const py = purchaseDate.getFullYear();
  const pm = purchaseDate.getMonth();
  const ay = asOf.getFullYear();
  const am = asOf.getMonth();
  const monthsElapsed = (ay - py) * 12 + (am - pm);
  if (monthsElapsed < 0) return 1;
  return Math.floor(monthsElapsed / 12) + 1;
}

/** Earliest purchase among filtered properties; used for aggregate table column titles. */
export function portfolioOwnershipYearLabelAnchor(properties: any[], asOf: Date): number | null {
  let earliest: Date | null = null;
  for (const p of properties as any[]) {
    const d = parsePurchaseDate(p);
    if (!d) continue;
    if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
  }
  if (!earliest) return null;
  return ownershipYearFromPurchase(earliest, asOf);
}

export type PortfolioAnalysisOverTimeColumn = {
  year: number;
  headerLabel: string;
  totalExpectedIncomeAnnual: number;
  totalExpensesAnnual: number;
  totalAnnualCashFlow: number;
  cashOnCashRoiPercent: number | null;
  totalPropertyValue: number;
  totalEquity: number;
  totalLoanBalance: number;
  /** Portfolio IRR % if all IRR-eligible properties exit uniformly at end of this horizon year (same mechanics as aggregate IRR). */
  irrPercent: number | null;
};

export type PortfolioAnalysisOverTimeResult = {
  columns: PortfolioAnalysisOverTimeColumn[];
  /** Ceiling applied (years forward); equals longest resolved bond payoff horizon or 30 when uncapped. */
  bondHorizonCapYears: number;
  limitedByBondSchedule: boolean;
};

type UniformHorizonIrrEligible = {
  property: any;
  invested: number;
  baseMonthlyIncome: number;
  baseMonthlyExpenseTotal: number;
};

function collectEligibleUniformHorizonIrr(
  properties: any[],
  statementMonthlyAverageByProperty: Map<number, StatementMonthlyIrrAverage>,
  currentMonthStatementIncomeByProperty: Map<number, number>,
  expenseMonthByProperty: Map<number, any[]>,
  projectionAsOf: Date,
  estimateCashInvestedForIrr: (p: any) => number | null
): UniformHorizonIrrEligible[] {
  const eligible: UniformHorizonIrrEligible[] = [];
  for (const p of properties as any[]) {
    const invested = estimateCashInvestedForIrr(p);
    const value = numMoney(p.currentEstimatedValue) ?? numMoney(p.purchasePrice);
    if (invested == null || invested <= 0 || value == null || value <= 0) continue;

    const { baseMonthlyIncome, baseMonthlyExpenseTotal } = computePropertyOperatingBaselineForProjection({
      property: p,
      statementMonthlyAverageByProperty,
      currentMonthStatementIncomeByProperty,
      expenseMonthByProperty,
      projectionAsOf
    });

    eligible.push({ property: p, invested, baseMonthlyIncome, baseMonthlyExpenseTotal });
  }
  return eligible;
}

/** Same stacking rules as {@link buildPortfolioProjectionIrrCashFlows}: yearly operating through H, exit proceeds net-of-costs added to CF_H (floored). */
function portfolioProjectionCashFlowsUniformHorizon(params: {
  eligible: UniformHorizonIrrEligible[];
  horizonYears: number;
  growth: PortfolioProjectionGrowth;
  appreciationDefaultPercent: number;
  sellCostDefaultPercent: number;
  projectionAsOf: Date;
}): number[] {
  const { eligible, horizonYears: H, growth, appreciationDefaultPercent, sellCostDefaultPercent, projectionAsOf } = params;
  const gInc = growth.rentalIncomeGrowthPercentAnnual / 100;
  const gExp = growth.totalExpensesGrowthPercentAnnual / 100;
  const cf = new Array(H + 1).fill(0);

  for (const e of eligible) {
    cf[0] -= e.invested;
    const { property: p, baseMonthlyIncome, baseMonthlyExpenseTotal } = e;

    for (let y = 1; y <= H; y++) {
      const annualInc = baseMonthlyIncome * 12 * Math.pow(1 + gInc, y - 1);
      const annualExp = baseMonthlyExpenseTotal * 12 * Math.pow(1 + gExp, y - 1);
      cf[y] += annualInc - annualExp;
    }

    const valueExit = numMoney(p.currentEstimatedValue) ?? numMoney(p.purchasePrice);
    if (valueExit == null || valueExit <= 0) continue;

    const app = numMoney(p.expectedAnnualAppreciationPercent) ?? appreciationDefaultPercent;
    const sellCostPct = numMoney(p.estimatedSellingCostPercent) ?? sellCostDefaultPercent;
    const appRate = Math.min(80, Math.max(-40, Number(app)));
    const sellCostRate = Math.min(40, Math.max(0, Number(sellCostPct)));
    const futureValue = Number(valueExit) * Math.pow(1 + appRate / 100, H);
    const sellingCosts = futureValue * (sellCostRate / 100);
    const { balance: bond } = projectBondBalanceAtHorizon(p, H * 12, projectionAsOf);
    const grossAfterCosts = futureValue - sellingCosts;
    const rawNetToEquity = grossAfterCosts - bond;
    const netSale = Math.max(0, rawNetToEquity);
    cf[H] += netSale;
  }

  return cf;
}

/** Horizon table for dashboard: operating cash escalates with admin growth; value with per-property appreciation (or default); loans amortised when resolvable (else snapshot). */
export function buildPortfolioAnalysisOverTime(params: {
  properties: any[];
  statementMonthlyAverageByProperty: Map<number, StatementMonthlyIrrAverage>;
  currentMonthStatementIncomeByProperty: Map<number, number>;
  expenseMonthByProperty: Map<number, any[]>;
  growth: PortfolioProjectionGrowth;
  appreciationDefaultPercent: number;
  sellCostDefaultPercent: number;
  projectionAsOf: Date;
  totalCashInvested: number;
  estimateCashInvestedForIrr: (p: any) => number | null;
}): PortfolioAnalysisOverTimeResult {
  const {
    properties,
    statementMonthlyAverageByProperty,
    currentMonthStatementIncomeByProperty,
    expenseMonthByProperty,
    growth,
    appreciationDefaultPercent,
    sellCostDefaultPercent,
    projectionAsOf,
    totalCashInvested,
    estimateCashInvestedForIrr
  } = params;

  let sumMonthlyIncome = 0;
  let sumMonthlyExpense = 0;
  for (const p of properties as any[]) {
    const b = computePropertyOperatingBaselineForProjection({
      property: p,
      statementMonthlyAverageByProperty,
      currentMonthStatementIncomeByProperty,
      expenseMonthByProperty,
      projectionAsOf
    });
    sumMonthlyIncome += b.baseMonthlyIncome;
    sumMonthlyExpense += b.baseMonthlyExpenseTotal;
  }

  const gInc = growth.rentalIncomeGrowthPercentAnnual / 100;
  const gExp = growth.totalExpensesGrowthPercentAnnual / 100;

  const roundMoney = (x: number) => Math.round(x * 100) / 100;

  const bondCeiling = portfolioBondScheduleHorizonYearsCeiling(properties, projectionAsOf);
  const horizonYears = buildPortfolioAnalysisHorizonYears(bondCeiling.capYears);

  const irrEligible = collectEligibleUniformHorizonIrr(
    properties,
    statementMonthlyAverageByProperty,
    currentMonthStatementIncomeByProperty,
    expenseMonthByProperty,
    projectionAsOf,
    estimateCashInvestedForIrr
  );

  const columns = horizonYears.map((t) => {
    const annualIncome = sumMonthlyIncome * 12 * Math.pow(1 + gInc, t - 1);
    const annualExpenses = sumMonthlyExpense * 12 * Math.pow(1 + gExp, t - 1);
    const annualCashFlow = annualIncome - annualExpenses;
    const cashOnCashRoiPercent =
      totalCashInvested > 1e-9 ? Math.round(((annualCashFlow / totalCashInvested) * 100 + Number.EPSILON) * 100) / 100 : null;

    let totalPropertyValue = 0;
    let totalLoanBalance = 0;
    for (const p of properties as any[]) {
      const value0 = numMoney(p.currentEstimatedValue) ?? numMoney(p.purchasePrice) ?? 0;
      const app = numMoney(p.expectedAnnualAppreciationPercent) ?? appreciationDefaultPercent;
      const appRate = Math.min(80, Math.max(-40, Number(app)));
      if (value0 > 0) {
        totalPropertyValue += value0 * Math.pow(1 + appRate / 100, t);
      }
      const { balance } = projectBondBalanceAtHorizon(p, t * 12, projectionAsOf);
      totalLoanBalance += balance;
    }

    const totalEquity = totalPropertyValue - totalLoanBalance;

    const ownershipAnchor = portfolioOwnershipYearLabelAnchor(properties, projectionAsOf);
    const displayOwnershipYear = ownershipAnchor != null ? ownershipAnchor + (t - 1) : null;
    const headerLabel =
      displayOwnershipYear != null
        ? displayOwnershipYear === ownershipAnchor
          ? `Year ${displayOwnershipYear} (current)`
          : `Year ${displayOwnershipYear}`
        : t === 1
          ? "Yr 1 (current)"
          : `Year ${t}`;

    let irrPercent: number | null = null;
    if (irrEligible.length > 0) {
      const cf = portfolioProjectionCashFlowsUniformHorizon({
        eligible: irrEligible,
        horizonYears: t,
        growth,
        appreciationDefaultPercent,
        sellCostDefaultPercent,
        projectionAsOf
      });
      const irrAttempt = cf[0] < -1e-9 && cf.slice(1).some((x) => Math.abs(x) > 1e-9);
      const irr = irrAttempt ? portfolioProjectionIrrRate(cf) : null;
      irrPercent = irr == null ? null : Math.round(irr * 100 * 100) / 100;
    }

    return {
      year: t,
      headerLabel,
      totalExpectedIncomeAnnual: roundMoney(annualIncome),
      totalExpensesAnnual: roundMoney(annualExpenses),
      totalAnnualCashFlow: roundMoney(annualCashFlow),
      cashOnCashRoiPercent,
      totalPropertyValue: roundMoney(totalPropertyValue),
      totalEquity: roundMoney(totalEquity),
      totalLoanBalance: roundMoney(totalLoanBalance),
      irrPercent
    };
  });

  return {
    columns,
    bondHorizonCapYears: bondCeiling.capYears,
    limitedByBondSchedule: bondCeiling.limitedByBondSchedule
  };
}

/** Portfolio IRR cash flows: CF0 negative invested; CF1..CF_{n-1} yearly operating; CF_n includes operating + exit proceeds for properties exiting that year. */
export function buildPortfolioProjectionIrrCashFlows(params: {
  properties: any[];
  expenseMonthByProperty: Map<number, any[]>;
  /** Trailing 12 months (selected month on dashboard): avg monthly income & expenses consistent with statement (ledger + paid invoices; bond from ledger or profile). */
  statementMonthlyAverageByProperty: Map<number, StatementMonthlyIrrAverage>;
  /** Selected month: received ledger + paid invoices for the property — fallback when averages are zero. */
  currentMonthStatementIncomeByProperty: Map<number, number>;
  growth: PortfolioProjectionGrowth;
  estimateCashInvested: (p: any) => number | null;
  appreciationDefaultPercent: number;
  sellCostDefaultPercent: number;
  defaultHoldingYears: number;
  /** Dashboard anchor month (bond remaining months resolved against this date). */
  projectionAsOf: Date;
  /** When set, every eligible property uses this holding horizon for operating cash + exit (aligned aggregate IRR). */
  uniformHoldingYears?: number | null;
}): {
  cashFlows: number[];
  holdingPeriodYearsMax: number;
  assumptions: string[];
  eligiblePropertyCount: number;
  canSolveIrr: boolean;
  /** Inputs fed into projected yearly operating cash flows (before exit proceeds added in CF_H). */
  eligibleInputs: Array<{
    propertyId: number;
    propertyName: string;
    invested: number;
    holdingYears: number;
    baseMonthlyIncome: number;
    baseMonthlyExpenseTotal: number;
    operatingBaseline: PortfolioIrrOperatingBaseline;
    bondExitBasis: "AMORTIZED" | "SNAPSHOT";
    bondBalanceAtExit: number;
  }>;
} {
  const {
    properties,
    expenseMonthByProperty,
    statementMonthlyAverageByProperty,
    currentMonthStatementIncomeByProperty,
    growth,
    estimateCashInvested,
    appreciationDefaultPercent,
    sellCostDefaultPercent,
    defaultHoldingYears,
    projectionAsOf,
    uniformHoldingYears
  } = params;

  const gInc = growth.rentalIncomeGrowthPercentAnnual / 100;
  const gExp = growth.totalExpensesGrowthPercentAnnual / 100;

  const uniformH =
    uniformHoldingYears != null && Number.isFinite(Number(uniformHoldingYears))
      ? Math.min(50, Math.max(1, Math.floor(Number(uniformHoldingYears))))
      : null;

  const assumptions: string[] = [
    `When both “expected monthly income” and “expected monthly expenses” are set on a property, year‑1 operating cash uses those figures (annualised); otherwise trailing‑12 statement averages (received income + paid invoices; expenses incl. bond). For non–short‑term rentals with an active lease, rental income baseline is max(trailing‑12 average, current contractual lease rent) when the ledger understates contracted rent. Then selected‑month / lease / STR fallbacks apply if still missing. Amounts escalate at ${growth.rentalIncomeGrowthPercentAnnual}% / ${growth.totalExpensesGrowthPercentAnnual}% per year for income vs expenses (admin defaults).`,
    `Bond owing at exit is amortised month‑by‑month from current outstanding balance using nominal annual rate + monthly instalment (stored payment or derived from balance & remaining term from bond duration + start date, or manual months remaining). If rate/payment cannot be resolved, the latest captured outstanding balance is used unchanged.`,
    `Property values at exit use each asset's expected annual appreciation % (or ${appreciationDefaultPercent}% default). Sale costs use each asset's estimated selling cost % (or ${sellCostDefaultPercent}% default). Equity cash at exit is max(0, gross sale − selling costs − bond) so underwater exits do not imply arbitrary negative payouts to equity (check bond/value if this triggers often).`
  ];

  if (uniformH != null) {
    assumptions.push(
      `Portfolio IRR horizon is fixed at ${uniformH} years for all properties (dashboard parameter); per-property holding periods are ignored for this aggregate.`
    );
  }

  let exitFlooredCount = 0;

  type Eligible = {
    property: any;
    invested: number;
    H: number;
    baseMonthlyIncome: number;
    baseMonthlyExpenseTotal: number;
    operatingBaseline: PortfolioIrrOperatingBaseline;
    bondAtExit: number;
    bondExitBasis: "AMORTIZED" | "SNAPSHOT";
  };
  const eligible: Eligible[] = [];
  const eligibleInputs: Array<{
    propertyId: number;
    propertyName: string;
    invested: number;
    holdingYears: number;
    baseMonthlyIncome: number;
    baseMonthlyExpenseTotal: number;
    operatingBaseline: PortfolioIrrOperatingBaseline;
    bondExitBasis: "AMORTIZED" | "SNAPSHOT";
    bondBalanceAtExit: number;
  }> = [];

  for (const p of properties as any[]) {
    const invested = estimateCashInvested(p);
    const value = numMoney(p.currentEstimatedValue) ?? numMoney(p.purchasePrice);

    if (invested == null || invested <= 0 || value == null || value <= 0) continue;

    const { baseMonthlyIncome, baseMonthlyExpenseTotal, operatingBaseline } = computePropertyOperatingBaselineForProjection({
      property: p,
      statementMonthlyAverageByProperty,
      currentMonthStatementIncomeByProperty,
      expenseMonthByProperty,
      projectionAsOf
    });

    const HRaw = Math.max(1, Math.floor(Number(p.holdingPeriodYears ?? defaultHoldingYears)) || defaultHoldingYears);
    const H = uniformH != null ? uniformH : HRaw;

    const { balance: bondEnd, amortized } = projectBondBalanceAtHorizon(p, H * 12, projectionAsOf);
    const snapshotBond = numMoney(p.outstandingBondBalance) ?? 0;
    const bondAtExit = amortized ? bondEnd : snapshotBond;
    const bondExitBasis: "AMORTIZED" | "SNAPSHOT" = amortized ? "AMORTIZED" : "SNAPSHOT";

    eligible.push({
      property: p,
      invested,
      H,
      baseMonthlyIncome,
      baseMonthlyExpenseTotal,
      operatingBaseline,
      bondAtExit,
      bondExitBasis
    });
    eligibleInputs.push({
      propertyId: p.id,
      propertyName: typeof p.name === "string" && p.name.trim() ? p.name : `Property #${p.id}`,
      invested,
      holdingYears: H,
      baseMonthlyIncome,
      baseMonthlyExpenseTotal,
      operatingBaseline,
      bondExitBasis,
      bondBalanceAtExit: bondAtExit
    });
  }

  if (!eligible.length) {
    return {
      cashFlows: [],
      holdingPeriodYearsMax: 0,
      assumptions,
      eligiblePropertyCount: 0,
      canSolveIrr: false,
      eligibleInputs: []
    };
  }

  const maxH = Math.max(1, ...eligible.map((e) => e.H));
  const cf = new Array(maxH + 1).fill(0);

  for (const e of eligible) {
    cf[0] -= e.invested;
    const { property: p, H, baseMonthlyIncome, baseMonthlyExpenseTotal } = e;

    for (let y = 1; y <= H; y++) {
      const annualInc = baseMonthlyIncome * 12 * Math.pow(1 + gInc, y - 1);
      const annualExp = baseMonthlyExpenseTotal * 12 * Math.pow(1 + gExp, y - 1);
      cf[y] += annualInc - annualExp;
    }

    const valueExit = numMoney(p.currentEstimatedValue) ?? numMoney(p.purchasePrice);
    if (valueExit == null || valueExit <= 0) continue;
    const app = numMoney(p.expectedAnnualAppreciationPercent) ?? appreciationDefaultPercent;
    const sellCostPct = numMoney(p.estimatedSellingCostPercent) ?? sellCostDefaultPercent;
    const appRate = Math.min(80, Math.max(-40, Number(app)));
    const sellCostRate = Math.min(40, Math.max(0, Number(sellCostPct)));
    const futureValue = Number(valueExit) * Math.pow(1 + appRate / 100, H);
    const sellingCosts = futureValue * (sellCostRate / 100);
    const bond = e.bondAtExit;
    const grossAfterCosts = futureValue - sellingCosts;
    const rawNetToEquity = grossAfterCosts - bond;
    const netSale = Math.max(0, rawNetToEquity);
    if (rawNetToEquity < -1e-3) exitFlooredCount += 1;
    cf[H] += netSale;
  }

  if (exitFlooredCount > 0) {
    assumptions.push(
      `${exitFlooredCount} propert${exitFlooredCount === 1 ? "y’s" : "ies’"} exit would imply negative equity payout vs captured bond/value — proceeds floored at zero for IRR (verify outstanding bond balance and estimated value).`
    );
  }

  /** Attempt numerical IRR whenever equity draw-down exists and there is any future cash-flow activity (sale can net negative). */
  const hasFutureCashFlow = cf.slice(1).some((x) => Math.abs(x) > 1e-9);
  const canSolveIrr = cf[0] < -1e-9 && hasFutureCashFlow;

  return {
    cashFlows: cf,
    holdingPeriodYearsMax: maxH,
    assumptions,
    eligiblePropertyCount: eligible.length,
    canSolveIrr,
    eligibleInputs
  };
}

/** Human-readable IRR pipeline status for dashboards / debugging. */
export function portfolioIrrExplainStatus(params: {
  filteredPropertyCount: number;
  eligiblePropertyCount: number;
  cashFlows: number[];
  irrAttempted: boolean;
  rateFound: boolean;
}): { code: string; message: string; cf0: number | null; yearlyCashFlows: number[]; sumUndiscounted: number } {
  const { filteredPropertyCount, eligiblePropertyCount, cashFlows, irrAttempted, rateFound } = params;
  const cf0 = cashFlows.length ? cashFlows[0] : null;
  const yearlyCashFlows = cashFlows.slice(1);
  const sumUndiscounted = cashFlows.reduce((s, x) => s + x, 0);

  if (filteredPropertyCount === 0) {
    return {
      code: "NO_PROPERTIES",
      message: "No properties match the current filters — nothing to run IRR on.",
      cf0,
      yearlyCashFlows,
      sumUndiscounted
    };
  }
  if (eligiblePropertyCount === 0) {
    return {
      code: "NO_ELIGIBLE",
      message:
        "No property qualified. Each asset needs (1) a positive value — current estimated value or purchase price, and (2) a positive CF₀ estimate: total cash invested, or purchase-based cash in, or equity (value − bond), or a deposit proxy.",
      cf0,
      yearlyCashFlows,
      sumUndiscounted
    };
  }
  if (!irrAttempted) {
    const fut = yearlyCashFlows.some((x) => Math.abs(x) > 1e-9);
    if (cf0 != null && cf0 >= -1e-9) {
      return {
        code: "CF0_NOT_NEGATIVE",
        message: `Combined upfront CF₀ is not negative (${cf0}). IRR expects initial cash invested as an outflow.`,
        cf0,
        yearlyCashFlows,
        sumUndiscounted
      };
    }
    if (!fut) {
      return {
        code: "NO_FUTURE_FLOWS",
        message:
          "Year-by-year portfolio cash flows after year 0 are all effectively zero — check income/expense averages and whether exits add sale proceeds.",
        cf0,
        yearlyCashFlows,
        sumUndiscounted
      };
    }
    return {
      code: "ATTEMPT_BLOCKED",
      message: "IRR solve was not attempted for an unexpected reason — see yearly cash flows.",
      cf0,
      yearlyCashFlows,
      sumUndiscounted
    };
  }
  if (rateFound) {
    return {
      code: "OK",
      message: "IRR solved: discount rate r where NPV of the yearly series below equals zero.",
      cf0,
      yearlyCashFlows,
      sumUndiscounted
    };
  }
  return {
    code: "SOLVER_NO_ROOT",
    message:
      "Cash flows were built but no IRR was found in the scanned rate range (−99.99% … very high). Typical causes: unconventional timing (multiple sign changes) or extremes — inspect yearly totals.",
    cf0,
    yearlyCashFlows,
    sumUndiscounted
  };
}

/** IRR via bracket bisection + dense scan (same solver as calculators). */
export function portfolioProjectionIrrRate(cashFlows: number[]): number | null {
  return solveIrrPeriodicCashFlows(cashFlows);
}
