import { solveIrrPeriodicCashFlows } from "@calculatorShared/irrSolver";
import {
  amortizingMonthlyPayment,
  inferMonthlyBondPaymentForExpenseBaseline,
  monthlyInterestFromAnnualPercent
} from "../../../api/lib/bondHelpers";

export const PORTFOLIO_PROJECTION_HORIZON_YEARS = 30;

export type PortfolioProjectionYearRow = {
  year: number;
  equity: number;
  cashFlow: number;
  income: number;
  expenses: number;
  cocRoi: number | null;
  roi: number | null;
  irr: number | null;
};

type PropertyState = {
  value: number;
  bond: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  cashInvested: number;
  appreciationPct: number;
  sellCostPct: number;
  ratePct: number;
  monthlyBondPayment: number;
};

function num(v: unknown, fallback = 0): number {
  if (v === "" || v == null) return fallback;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function matchesPropertyFilter(
  p: Record<string, unknown>,
  propertyTypes: string[],
  propertyId: string | number | null
): boolean {
  if (propertyId != null && String(p.id) !== String(propertyId)) return false;
  if (!propertyTypes.length) return true;
  const t = String(p.investmentType ?? p.propertyType ?? "").toUpperCase();
  return propertyTypes.some((x) => x.toUpperCase() === t);
}

function projectionGrowthRates(data: Record<string, unknown> | null | undefined) {
  const k = (data?.kpis ?? {}) as Record<string, unknown>;
  const analysis = k.portfolioAnalysisOverTime as
    | {
        projectionGrowth?: { rentalIncomeGrowthPercentAnnual?: number; totalExpensesGrowthPercentAnnual?: number };
        appreciationDefaultPercent?: number;
      }
    | undefined;
  const irrProj = (k.portfolioIRR as { projectionGrowth?: { rentalIncomeGrowthPercentAnnual?: number; totalExpensesGrowthPercentAnnual?: number } })
    ?.projectionGrowth;

  const rentPct = num(
    analysis?.projectionGrowth?.rentalIncomeGrowthPercentAnnual ?? irrProj?.rentalIncomeGrowthPercentAnnual,
    5
  );
  const expPct = num(
    analysis?.projectionGrowth?.totalExpensesGrowthPercentAnnual ?? irrProj?.totalExpensesGrowthPercentAnnual,
    5
  );
  const appreciationDefault = num(analysis?.appreciationDefaultPercent, 5);

  return {
    rentGrowth: rentPct / 100,
    expenseGrowth: expPct / 100,
    appreciationDefault
  };
}

function bondPaymentForProperty(p: Record<string, unknown>, asOf: Date): number {
  const stored = num(p.monthlyBondPayment);
  if (stored > 0) return stored;
  const inferred = inferMonthlyBondPaymentForExpenseBaseline(p, asOf);
  return inferred?.monthlyPayment ?? 0;
}

function bondRateForProperty(p: Record<string, unknown>): number {
  const rate = num(p.bondAnnualInterestRatePercent);
  return rate > 0 ? rate : 11.75;
}

function amortizeBondOneYear(balance: number, ratePct: number, monthlyPayment: number): number {
  let b = Math.max(0, balance);
  if (b <= 0) return 0;
  const pmt = monthlyPayment > 0 ? monthlyPayment : monthlyInterestFromAnnualPercent(b, ratePct);
  for (let m = 0; m < 12; m += 1) {
    if (b <= 0) break;
    const interest = monthlyInterestFromAnnualPercent(b, ratePct);
    const principal = Math.min(b, Math.max(0, pmt - interest));
    b = Math.max(0, b - principal);
  }
  return round2(b);
}

function buildPropertyStates(
  properties: Record<string, unknown>[],
  data: Record<string, unknown> | null | undefined,
  propertyTypes: string[],
  propertyId: string | number | null,
  appreciationDefault: number
): PropertyState[] {
  const charts = (data?.charts ?? {}) as Record<string, unknown>;
  const cashRows = (charts.cashFlowByProperty ?? []) as Array<{
    propertyId?: string;
    monthlyIncome?: number;
    monthlyExpenses?: number;
  }>;
  const cashById = new Map(cashRows.map((r) => [String(r.propertyId), r]));
  const asOf = new Date();

  return properties
    .filter((p) => matchesPropertyFilter(p, propertyTypes, propertyId))
    .map((p) => {
      const id = String(p.id);
      const cash = cashById.get(id);
      const value = num(p.currentEstimatedValue) || num(p.purchasePrice);
      const bond = num(p.outstandingBondBalance);

      let monthlyIncome = num(cash?.monthlyIncome);
      if (monthlyIncome <= 0) {
        monthlyIncome =
          num(p.expectedMonthlyIncome) || num(p.monthlyIncome) || num(p.monthlyRent) || num(p.combinedMonthlyLeaseRent);
      }

      let monthlyExpenses = num(cash?.monthlyExpenses);
      if (monthlyExpenses <= 0) {
        const operating = num(p.expectedMonthlyExpenses) || num(p.monthlyOperatingExpenses) || num(p.monthlyExpenses);
        const debt = bondPaymentForProperty(p, asOf) || num(p.monthlyDebtService);
        monthlyExpenses = operating + debt;
      }

      const ratePct = bondRateForProperty(p);
      let monthlyBondPayment = bondPaymentForProperty(p, asOf);
      if (monthlyBondPayment <= 0 && bond > 0) {
        const rem = num(p.bondRemainingTermMonths) || (num(p.bondTermYears) > 0 ? num(p.bondTermYears) * 12 : 0);
        if (rem > 0) {
          const pmt = amortizingMonthlyPayment(bond, ratePct, rem);
          if (pmt != null) monthlyBondPayment = pmt;
        }
      }

      return {
        value,
        bond,
        monthlyIncome,
        monthlyExpenses,
        cashInvested: num(p.totalCashInvested),
        appreciationPct: num(p.expectedAnnualAppreciationPercent) || appreciationDefault,
        sellCostPct: num(p.estimatedSellingCostPercent, 5),
        ratePct,
        monthlyBondPayment
      } satisfies PropertyState;
    })
    .filter((s) => s.value > 0 || s.cashInvested > 0 || s.monthlyIncome > 0 || s.bond > 0);
}

function irrThroughHorizon(
  cashInvested: number,
  annualCashFlows: number[],
  horizonYear: number,
  exitProceeds: number
): number | null {
  if (!(cashInvested > 0) || horizonYear < 1) return null;
  const flows: number[] = [-cashInvested];
  for (let y = 1; y < horizonYear; y += 1) {
    flows.push(annualCashFlows[y - 1] ?? 0);
  }
  const lastOp = annualCashFlows[horizonYear - 1] ?? 0;
  flows.push(lastOp + exitProceeds);
  const rate = solveIrrPeriodicCashFlows(flows);
  return rate == null ? null : round2(rate * 100);
}

/**
 * Builds years 1–30 of portfolio-level projections from property assumptions and admin growth defaults.
 * Uses ledger month snapshots when available; otherwise expected monthly income/expenses on each property.
 */
export function buildPortfolioProjectionYears(
  data: Record<string, unknown> | null | undefined,
  properties: Record<string, unknown>[],
  opts?: {
    horizonYears?: number;
    propertyTypes?: string[];
    propertyId?: string | number | null;
  }
): PortfolioProjectionYearRow[] {
  const horizon = opts?.horizonYears ?? PORTFOLIO_PROJECTION_HORIZON_YEARS;
  const propertyTypes = opts?.propertyTypes ?? [];
  const propertyId = opts?.propertyId ?? null;
  const { rentGrowth, expenseGrowth, appreciationDefault } = projectionGrowthRates(data);

  const states = buildPropertyStates(properties, data, propertyTypes, propertyId, appreciationDefault);
  if (!states.length) return [];

  const totalCashInvested = states.reduce((s, p) => s + Math.max(0, p.cashInvested), 0);
  const annualCashFlows: number[] = [];
  let cumulativeProfit = 0;

  const working = states.map((s) => ({ ...s }));

  const rows: PortfolioProjectionYearRow[] = [];

  for (let year = 1; year <= horizon; year += 1) {
    let equity = 0;
    let income = 0;
    let expenses = 0;
    let cashFlow = 0;
    let exitProceeds = 0;

    working.forEach((p) => {
      const incomeAnnual = p.monthlyIncome * 12 * Math.pow(1 + rentGrowth, year - 1);
      const expenseAnnual = p.monthlyExpenses * 12 * Math.pow(1 + expenseGrowth, year - 1);
      const cf = incomeAnnual - expenseAnnual;

      p.value = round2(p.value * (1 + p.appreciationPct / 100));
      p.bond = amortizeBondOneYear(p.bond, p.ratePct, p.monthlyBondPayment);

      const sellingCosts = p.value * (p.sellCostPct / 100);
      const netSale = Math.max(0, p.value - sellingCosts - p.bond);

      income += incomeAnnual;
      expenses += expenseAnnual;
      cashFlow += cf;
      equity += Math.max(0, p.value - p.bond);
      exitProceeds += netSale;
    });

    income = round2(income);
    expenses = round2(expenses);
    cashFlow = round2(cashFlow);
    equity = round2(equity);
    cumulativeProfit = round2(cumulativeProfit + cashFlow);
    annualCashFlows.push(cashFlow);

    const cocRoi = totalCashInvested > 0 ? round2((cashFlow / totalCashInvested) * 100) : null;
    const roi = totalCashInvested > 0 ? round2((cumulativeProfit / totalCashInvested) * 100) : null;
    const irr = irrThroughHorizon(totalCashInvested, annualCashFlows, year, exitProceeds);

    rows.push({ year, equity, cashFlow, income, expenses, cocRoi, roi, irr });
  }

  return rows;
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}
