import type { PropertyTypeId } from "../../data/calculatorPropertyTypes";
import { solveIrrPeriodicCashFlows } from "@calculatorShared/irrSolver";
import { monthlyBondRepayment } from "../../utils/mortgageRepayment";

export type NormalizedCalcResult = {
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  projectedCashFlow: number | null; // monthly net (income - expenses - bond)
  annualCashFlow: number | null;
  grossYield: number | null; // %
  netYield: number | null; // %
  cashOnCashRoi: number | null; // %
  internalRateofReturn: number | null; // %
  ltv: number | null; // %
  unitsOccupied: { occupied: number; total: number } | null;
  monthlyBondPayment: number | null;
  other?: Record<string, number | string | boolean | null>;
};

function n(x: unknown): number | null {
  if (x == null) return null;
  const s = typeof x === "string" ? x : String(x);
  const cleaned = s.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
}

function pctToRate(p: number | null): number | null {
  if (p == null) return null;
  return p / 100;
}

function clampPct(p: number | null): number | null {
  if (p == null) return null;
  if (!Number.isFinite(p)) return null;
  return Math.min(100, Math.max(0, p));
}

function sum(...vals: Array<number | null | undefined>): number {
  return vals.reduce((s, v) => s + (v != null && Number.isFinite(v) ? v : 0), 0);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function safeDiv(numer: number, denom: number): number | null {
  if (!(denom > 0) || !Number.isFinite(numer) || !Number.isFinite(denom)) return null;
  return numer / denom;
}

function calcBondPaymentMonthly(values: Record<string, string>): number | null {
  const loan = n(values.loanAmount);
  const rate = n(values.interestRateApr);
  const term = n(values.loanTermYears);
  if (!(loan != null && loan > 0) || !(rate != null && rate > 0) || !(term != null && term > 0)) return null;
  return monthlyBondRepayment(loan, rate, term);
}

function calcLtv(values: Record<string, string>): number | null {
  const loan = n(values.loanAmount);
  const purchase = n(values.purchasePrice);
  const market = n(values.marketValue);
  const base = market && market > 0 ? market : purchase;
  if (!(loan != null && loan > 0) || !(base != null && base > 0)) return null;
  return round2((loan / base) * 100);
}

function irrFromSimpleHold(opts: {
  cashInvested: number | null;
  annualCashFlow: number | null;
  holdYears: number | null;
  exitProceeds: number | null;
}): number | null {
  const cashInvested = opts.cashInvested ?? null;
  const annualCashFlow = opts.annualCashFlow ?? null;
  const holdYears = opts.holdYears ?? null;
  const exitProceeds = opts.exitProceeds ?? null;
  if (!(cashInvested != null && cashInvested > 0)) return null;
  if (!(holdYears != null && holdYears >= 1)) return null;
  if (exitProceeds == null) return null;

  const flows: number[] = [-cashInvested];
  for (let y = 1; y < holdYears; y += 1) flows.push(annualCashFlow ?? 0);
  flows.push((annualCashFlow ?? 0) + exitProceeds);
  const rate = solveIrrPeriodicCashFlows(flows);
  return rate == null ? null : round2(rate * 100);
}

function calcCommonMonthlyExpenses(values: Record<string, string>): number {
  const rates = n(values.ratesTaxesMonthly);
  const insurance = n(values.insuranceMonthly);
  const maintenance = n(values.maintenanceReserveMonthly);
  const utilities = n(values.utilitiesMonthly);
  const levies = n(values.hoaLeviesMonthly);
  const internet = n(values.internetCommonMonthly);
  const furnishing = n(values.furnishingAllowanceMonthly);
  const consumables = n(values.consumablesMonthly);
  const cleaningCosts = n(values.cleaningCostsMonthly);
  const operating = n(values.operatingExpensesMonthly);
  const cam = n(values.camMonthly);

  return sum(rates, insurance, maintenance, utilities, levies, internet, furnishing, consumables, cleaningCosts, operating, cam);
}

function applyPercentExpense(baseIncome: number, pct: number | null): number {
  if (!(baseIncome > 0)) return 0;
  if (pct == null || !Number.isFinite(pct)) return 0;
  return (baseIncome * pct) / 100;
}

export function calculatePropertyTypeMetrics(
  propertyType: PropertyTypeId,
  values: Record<string, string>
): NormalizedCalcResult {
  const purchasePrice = n(values.purchasePrice);
  const marketValue = n(values.marketValue);
  const cashInvested = n(values.cashInvested);
  const closingCosts = n(values.closingCosts);
  const repairs = n(values.repairsRenovation);
  const vacancyPct = clampPct(n(values.vacancyAllowancePct));
  const mgmtFeePct = clampPct(n(values.managementFeePct));

  const bondPmt = calcBondPaymentMonthly(values);
  const ltv = calcLtv(values);

  // Hold/exit (simple IRR projection)
  const holdYears = n(values.holdYears);
  const appreciationPct = clampPct(n(values.expectedAppreciationPct));
  const baseValue = (marketValue && marketValue > 0 ? marketValue : purchasePrice) ?? null;
  const expectedExitValue =
    baseValue != null && appreciationPct != null && holdYears != null
      ? baseValue * Math.pow(1 + appreciationPct / 100, Math.max(0, holdYears))
      : null;
  const exitProceeds = expectedExitValue; // simplified (ignores selling costs + outstanding balance)

  const commonFixedExpenses = calcCommonMonthlyExpenses(values);

  // Income by type
  let monthlyIncome: number | null = null;
  let occupied: { occupied: number; total: number } | null = null;
  let typeSpecificExpenses = 0;
  let other: Record<string, number | string | boolean | null> = {};

  if (propertyType === "single-family") {
    const rent = n(values.monthlyRent);
    if (rent != null) {
      const effective = rent * (1 - (vacancyPct ?? 0) / 100);
      monthlyIncome = effective;
      other.grossRent = rent;
    }
    occupied = { occupied: 1, total: 1 };
  } else if (propertyType === "duplex") {
    const u1 = n(values.unit1Rent);
    const u2 = n(values.unit2Rent);
    const u1Occ = values.unit1Occupied !== "false";
    const u2Occ = values.unit2Occupied !== "false";
    const gross = (u1Occ ? u1 ?? 0 : 0) + (u2Occ ? u2 ?? 0 : 0);
    const effective = gross * (1 - (vacancyPct ?? 0) / 100);
    monthlyIncome = gross > 0 ? effective : null;
    occupied = { occupied: (u1Occ ? 1 : 0) + (u2Occ ? 1 : 0), total: 2 };
    other.grossRent = gross;
  } else if (propertyType === "apartment") {
    const rent = n(values.monthlyRent);
    const occ = clampPct(n(values.occupancyPct));
    const occRate = occ != null ? occ / 100 : 1;
    if (rent != null) monthlyIncome = rent * occRate;
    occupied = { occupied: occ != null ? Math.round(occ) : 1, total: 100 }; // represent as percent-like if provided
    const landlordUtilities = values.utilitiesLandlordPaid === "true";
    if (!landlordUtilities) {
      // if utilities are not landlord-paid, ignore utilitiesMonthly
      // (user can still add other expenses via maintenance/insurance/taxes etc.)
      // handled by calcCommonMonthlyExpenses which includes utilitiesMonthly; so remove it here
      typeSpecificExpenses -= n(values.utilitiesMonthly) ?? 0;
    }
  } else if (propertyType === "multi-family") {
    const units = n(values.unitCount);
    const avgRent = n(values.avgRentPerUnit);
    const occ = clampPct(n(values.occupancyPct));
    const occRate = occ != null ? occ / 100 : 1;
    if (units != null && avgRent != null) monthlyIncome = units * avgRent * occRate;
    occupied = units != null ? { occupied: Math.round((units * (occRate ?? 0)) || 0), total: Math.round(units) } : null;
    other.unitCount = units;
  } else if (propertyType === "student-housing") {
    const beds = n(values.bedCount);
    const rentPer = n(values.rentPerBed);
    const occ = clampPct(n(values.occupancyPct));
    const occRate = occ != null ? occ / 100 : 1;
    if (beds != null && rentPer != null) monthlyIncome = beds * rentPer * occRate;
    occupied = beds != null ? { occupied: Math.round((beds * occRate) || 0), total: Math.round(beds) } : null;
    other.bedCount = beds;
  } else if (propertyType === "airbnb") {
    const nightly = n(values.avgNightlyRate);
    const occ = clampPct(n(values.occupancyRatePct));
    const nights = n(values.avgNightsBookedPerMonth);
    const cleaningIncome = n(values.cleaningFeeIncomeMonthly);
    const occRate = occ != null ? occ / 100 : null;

    // Prefer explicit nights; otherwise approximate from occupancy * 30.
    let nightsBooked: number | null = null;
    if (nights != null) nightsBooked = nights;
    else if (occRate != null) nightsBooked = occRate * 30;

    if (nightly != null && nightsBooked != null) {
      const base = nightly * nightsBooked;
      monthlyIncome = base + (cleaningIncome ?? 0);
      other.nightsBooked = round2(nightsBooked);
    }

    const platformFeesPct = clampPct(n(values.platformFeesPct));
    const platformFees = monthlyIncome != null ? applyPercentExpense(monthlyIncome, platformFeesPct) : 0;
    typeSpecificExpenses += platformFees;
    other.platformFeesMonthly = platformFees ? round2(platformFees) : null;
    occupied = nightsBooked != null ? { occupied: Math.round(nightsBooked), total: 30 } : null;
  } else if (propertyType === "commercial") {
    const income = n(values.monthlyLeaseIncome);
    if (income != null) {
      const effective = income * (1 - (vacancyPct ?? 0) / 100);
      monthlyIncome = effective;
      other.grossLeaseIncome = income;
    }
    occupied = { occupied: 1, total: 1 };
  } else if (propertyType === "vacant-land") {
    // No rent by default; focus on holding costs and appreciation.
    monthlyIncome = null;
    occupied = null;
  }

  const managementFee = monthlyIncome != null ? applyPercentExpense(monthlyIncome, mgmtFeePct) : 0;
  const monthlyExpenses = monthlyIncome == null ? null : round2(commonFixedExpenses + typeSpecificExpenses + managementFee);
  const cashFlow =
    monthlyIncome == null
      ? null
      : round2(monthlyIncome - (monthlyExpenses ?? 0) - (bondPmt ?? 0));

  const annualCashFlow = cashFlow == null ? null : round2(cashFlow * 12);

  const grossYield =
    purchasePrice != null && purchasePrice > 0 && monthlyIncome != null
      ? round2(((monthlyIncome * 12) / purchasePrice) * 100)
      : null;

  const netYield =
    purchasePrice != null && purchasePrice > 0 && monthlyIncome != null && monthlyExpenses != null
      ? round2((((monthlyIncome - monthlyExpenses) * 12) / purchasePrice) * 100)
      : null;

  const totalCashIn =
    (cashInvested ?? null) != null
      ? (cashInvested ?? 0) + (closingCosts ?? 0) + (repairs ?? 0)
      : null;

  const cashOnCashRoi =
    totalCashIn != null && totalCashIn > 0 && annualCashFlow != null
      ? round2((annualCashFlow / totalCashIn) * 100)
      : null;

  const irr =
    totalCashIn != null && totalCashIn > 0
      ? irrFromSimpleHold({
          cashInvested: totalCashIn,
          annualCashFlow,
          holdYears,
          exitProceeds
        })
      : null;

  if (propertyType === "vacant-land") {
    const holding = n(values.holdingCostsMonthly) ?? n(values.holdingCostsMonthly);
    const rates = n(values.ratesTaxesMonthly);
    const landExpenses = sum(holding, rates);
    return {
      monthlyIncome: null,
      monthlyExpenses: landExpenses > 0 ? round2(landExpenses) : null,
      projectedCashFlow: landExpenses > 0 ? round2(-landExpenses) : null,
      annualCashFlow: landExpenses > 0 ? round2(-landExpenses * 12) : null,
      grossYield: null,
      netYield: null,
      cashOnCashRoi,
      internalRateofReturn: irr,
      ltv,
      unitsOccupied: null,
      monthlyBondPayment: bondPmt,
      other: {
        expectedExitValue: expectedExitValue != null ? round2(expectedExitValue) : null
      }
    };
  }

  return {
    monthlyIncome: monthlyIncome != null ? round2(monthlyIncome) : null,
    monthlyExpenses,
    projectedCashFlow: cashFlow,
    annualCashFlow,
    grossYield,
    netYield,
    cashOnCashRoi,
    internalRateofReturn: irr,
    ltv,
    unitsOccupied: occupied,
    monthlyBondPayment: bondPmt != null ? round2(bondPmt) : null,
    other: Object.keys(other).length ? other : undefined
  };
}

