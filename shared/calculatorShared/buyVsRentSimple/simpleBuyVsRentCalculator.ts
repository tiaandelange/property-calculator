import { formatCurrency, formatPercent, round2 } from "../calculatorHelpers.js";
import type { CalculatorResult, SummaryMetric } from "../calculatorTypes.js";
import {
  SIMPLE_BUY_VS_RENT_ASSUMPTIONS_DISPLAY,
  SIMPLE_BUY_VS_RENT_ASSUMPTIONS_NOTE,
  SIMPLE_BUY_VS_RENT_BACKGROUND,
  SIMPLE_BUY_VS_RENT_UPGRADE_PROMPT
} from "./simpleBuyVsRentDefaults.js";
import { generateSimpleBuyVsRentConclusion } from "./simpleBuyVsRentConclusion.js";
import type {
  SimpleBuyVsRentBetterOption,
  SimpleBuyVsRentCoreResult,
  SimpleBuyVsRentInputs,
  SimpleBuyVsRentVerdict,
  SimpleBuyVsRentYearRow
} from "./simpleBuyVsRentTypes.js";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function monthlyBondPayment(bondAmount: number, annualInterestRate: number, bondTermYears: number): number {
  if (bondAmount <= 0) return 0;
  const monthlyInterestRate = annualInterestRate / 100 / 12;
  const numberOfPayments = bondTermYears * 12;
  if (monthlyInterestRate > 0) {
    const factor = Math.pow(1 + monthlyInterestRate, numberOfPayments);
    return bondAmount * ((monthlyInterestRate * factor) / (factor - 1));
  }
  return bondAmount / numberOfPayments;
}

function outstandingBondBalance(
  bondAmount: number,
  annualInterestRate: number,
  bondTermYears: number,
  monthsPaid: number
): number {
  if (bondAmount <= 0) return 0;
  const monthlyInterestRate = annualInterestRate / 100 / 12;
  const numberOfPayments = bondTermYears * 12;
  if (monthsPaid >= numberOfPayments) return 0;
  if (monthlyInterestRate <= 0) {
    return Math.max(0, bondAmount - (bondAmount / numberOfPayments) * monthsPaid);
  }
  const factor = Math.pow(1 + monthlyInterestRate, numberOfPayments);
  const paidFactor = Math.pow(1 + monthlyInterestRate, monthsPaid);
  return bondAmount * ((factor - paidFactor) / (factor - 1));
}

function classifyBetterOption(
  difference: number,
  netBuying: number,
  netRenting: number
): SimpleBuyVsRentBetterOption {
  const threshold = (SIMPLE_BUY_VS_RENT_BACKGROUND.closeCallThresholdPercent / 100) * Math.max(netBuying, netRenting, 1);
  if (Math.abs(difference) <= threshold) return "tie";
  return difference > 0 ? "buy" : "rent";
}

function verdictFromDifference(
  difference: number,
  netBuying: number,
  netRenting: number
): SimpleBuyVsRentVerdict {
  const option = classifyBetterOption(difference, netBuying, netRenting);
  if (option === "tie") return "close";
  return option;
}

function collectWarnings(input: SimpleBuyVsRentInputs, bondAmount: number): string[] {
  const warnings: string[] = [];
  const { purchasePrice, monthlyRent, depositAmount, analysisYears, propertyAppreciation } = input;

  if (depositAmount >= purchasePrice) {
    warnings.push("Deposit must be less than the property price.");
  }
  if (propertyAppreciation < 0) {
    warnings.push("Negative property growth is selected — buying may look weaker unless rents rise faster.");
  }
  if (analysisYears === 5) {
    warnings.push("Shorter periods often favour renting because buying has high upfront costs.");
  }
  if (monthlyRent < purchasePrice * 0.004) {
    warnings.push(
      "Rent appears low compared with the property price. Renting may be financially stronger unless property growth is high."
    );
  }
  if (monthlyRent > purchasePrice * 0.01) {
    warnings.push(
      "Rent appears high compared with the property price. Buying may become attractive sooner, but affordability still matters."
    );
  }
  if (bondAmount <= 0) {
    warnings.push("No bond is required at these inputs — compare is mainly cash versus rent.");
  }

  return warnings;
}

export function runSimpleBuyVsRentCalculator(input: SimpleBuyVsRentInputs): SimpleBuyVsRentCoreResult {
  const bg = SIMPLE_BUY_VS_RENT_BACKGROUND;
  const years = Math.round(input.analysisYears);
  const purchasePrice = input.purchasePrice;
  const depositAmount = clamp(input.depositAmount, 0, Math.max(0, purchasePrice - 0.01));
  const bondAmount = Math.max(0, purchasePrice - depositAmount);

  const upfrontBuyingCosts =
    purchasePrice * (bg.transferAndLegalCostPercent / 100) +
    bondAmount * (bg.bondRegistrationCostPercent / 100);
  const buyerInitialCashOut = depositAmount + upfrontBuyingCosts;
  const renterInitialCashOut = input.monthlyRent * bg.rentalDepositMonths;
  const initialCashAvailableToInvestIfRenting = Math.max(buyerInitialCashOut - renterInitialCashOut, 0);

  const bondPaymentMonthly = monthlyBondPayment(bondAmount, input.interestRate, bg.bondTermYears);
  const ratesTaxesMonthly = purchasePrice * bg.ratesTaxesMonthlyFactor;
  const insuranceMonthly = purchasePrice * bg.insuranceMonthlyFactor;
  const leviesMonthly = bg.leviesMonthly;

  let rentingInvestmentBalance = initialCashAvailableToInvestIfRenting;
  let cumulativeBuyingCashPaid = buyerInitialCashOut;
  let cumulativeRentPaid = renterInitialCashOut;

  const yearRows: SimpleBuyVsRentYearRow[] = [];
  let breakEvenYear: number | null = null;

  const yearOneAnnualOwnership =
    bondPaymentMonthly * 12 +
    ratesTaxesMonthly * 12 +
    insuranceMonthly * 12 +
    leviesMonthly * 12 +
    purchasePrice * (bg.maintenancePercent / 100);
  const startingMonthlyCostBuy = yearOneAnnualOwnership / 12;
  const startingMonthlyCostRent = input.monthlyRent + bg.renterOtherMonthlyCosts;

  for (let year = 1; year <= years; year += 1) {
    const monthsPaid = year * 12;
    const outstandingBond = outstandingBondBalance(bondAmount, input.interestRate, bg.bondTermYears, monthsPaid);
    const propertyValue = purchasePrice * Math.pow(1 + input.propertyAppreciation / 100, year);

    const annualBondPayments = bondPaymentMonthly * 12;
    const ownershipInflationFactor = Math.pow(1 + bg.ownershipCostInflation / 100, year - 1);
    const annualRatesTaxes = ratesTaxesMonthly * 12 * ownershipInflationFactor;
    const annualInsurance = insuranceMonthly * 12 * ownershipInflationFactor;
    const annualLevies = leviesMonthly * 12 * ownershipInflationFactor;
    const annualMaintenance = propertyValue * (bg.maintenancePercent / 100);
    const annualOwnershipCashOut =
      annualBondPayments + annualRatesTaxes + annualInsurance + annualLevies + annualMaintenance;

    const annualRent = input.monthlyRent * 12 * Math.pow(1 + input.rentEscalation / 100, year - 1);
    const annualRentingCashOut = annualRent + bg.renterOtherMonthlyCosts * 12;

    rentingInvestmentBalance *= 1 + bg.investmentReturn / 100;
    const annualSavingsFromRenting = annualOwnershipCashOut - annualRentingCashOut;
    if (annualSavingsFromRenting > 0) {
      rentingInvestmentBalance += annualSavingsFromRenting;
    }

    const grossHomeEquity = propertyValue - outstandingBond;
    const sellingCosts = propertyValue * (bg.sellingCostPercent / 100);
    const netBuyingPosition = grossHomeEquity - sellingCosts;

    const rentalDepositRefund = year === years ? input.monthlyRent * bg.rentalDepositMonths : 0;
    const netRentingPosition = rentingInvestmentBalance + rentalDepositRefund;

    const difference = netBuyingPosition - netRentingPosition;
    const betterOption = classifyBetterOption(difference, netBuyingPosition, netRentingPosition);

    if (breakEvenYear === null && difference > 0) {
      breakEvenYear = year;
    }

    cumulativeBuyingCashPaid += annualOwnershipCashOut;
    cumulativeRentPaid += annualRentingCashOut;

    yearRows.push({
      year,
      propertyValue: round2(propertyValue),
      outstandingBond: round2(outstandingBond),
      netBuyingPosition: round2(netBuyingPosition),
      netRentingPosition: round2(netRentingPosition),
      annualOwnershipCashOut: round2(annualOwnershipCashOut),
      annualRentingCashOut: round2(annualRentingCashOut),
      cumulativeBuyingCashPaid: round2(cumulativeBuyingCashPaid),
      cumulativeRentPaid: round2(cumulativeRentPaid),
      difference: round2(difference),
      betterOption
    });
  }

  const last = yearRows[yearRows.length - 1];
  const netBuyingPositionEnd = last?.netBuyingPosition ?? 0;
  const netRentingPositionEnd = last?.netRentingPosition ?? initialCashAvailableToInvestIfRenting;
  const differenceAfterPeriod = last?.difference ?? 0;
  const verdict = verdictFromDifference(differenceAfterPeriod, netBuyingPositionEnd, netRentingPositionEnd);

  const periodLabel = years === 1 ? "1 year" : `${years} years`;
  const absDiff = Math.abs(differenceAfterPeriod);

  const betterOptionLabel =
    verdict === "buy"
      ? "Buying looks stronger"
      : verdict === "rent"
        ? "Renting looks stronger"
        : "Too close to call";

  const differenceHeadline =
    verdict === "close"
      ? `Buying and renting are within about ${formatCompactZar(absDiff)} after ${periodLabel}`
      : verdict === "buy"
        ? `Buying is ahead by about ${formatCompactZar(absDiff)} after ${periodLabel}`
        : `Renting is ahead by about ${formatCompactZar(absDiff)} after ${periodLabel}`;

  const homeEquityHeadline = `Estimated buying position: ${formatCompactZar(netBuyingPositionEnd)}`;
  const rentingInvestmentHeadline = `Estimated renting position: ${formatCompactZar(netRentingPositionEnd)}`;

  const breakEvenHeadline =
    breakEvenYear === null
      ? "Buying does not break even within this period"
      : breakEvenYear === 1
        ? "Buying breaks even around Year 1"
        : `Buying breaks even around Year ${breakEvenYear}`;

  const summary = {
    betterOptionLabel,
    differenceHeadline,
    homeEquityHeadline,
    rentingInvestmentHeadline,
    breakEvenHeadline,
    verdict,
    differenceAfterPeriod: round2(differenceAfterPeriod),
    netBuyingPositionEnd: round2(netBuyingPositionEnd),
    netRentingPositionEnd: round2(netRentingPositionEnd),
    breakEvenYear
  };

  const comparisonTable = {
    finalPositionBuy: netBuyingPositionEnd,
    finalPositionRent: netRentingPositionEnd,
    startingMonthlyCostBuy: round2(startingMonthlyCostBuy),
    startingMonthlyCostRent: round2(startingMonthlyCostRent),
    totalPaidBuy: last?.cumulativeBuyingCashPaid ?? cumulativeBuyingCashPaid,
    totalPaidRent: last?.cumulativeRentPaid ?? cumulativeRentPaid,
    betterFinalPosition: classifyBetterOption(
      differenceAfterPeriod,
      netBuyingPositionEnd,
      netRentingPositionEnd
    )
  };

  return {
    inputs: input,
    bondAmount: round2(bondAmount),
    monthlyBondPayment: round2(bondPaymentMonthly),
    upfrontBuyingCosts: round2(upfrontBuyingCosts),
    buyerInitialCashOut: round2(buyerInitialCashOut),
    renterInitialCashOut: round2(renterInitialCashOut),
    initialCashAvailableToInvestIfRenting: round2(initialCashAvailableToInvestIfRenting),
    yearRows,
    summary,
    comparisonTable,
    warnings: collectWarnings(input, bondAmount)
  };
}

/** Compact ZAR for cards (e.g. R1.2m). */
export function formatCompactZar(amount: number): string {
  const n = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const text = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "");
    return `${sign}R${text}m`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    const text = k >= 100 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "");
    return `${sign}R${text}k`;
  }
  return `${sign}R${Math.round(n).toLocaleString("en-ZA")}`;
}

export function simpleBuyVsRentAssumptionsPayload() {
  return {
    assumptions: [...SIMPLE_BUY_VS_RENT_ASSUMPTIONS_DISPLAY],
    note: SIMPLE_BUY_VS_RENT_ASSUMPTIONS_NOTE,
    upgradePrompt: SIMPLE_BUY_VS_RENT_UPGRADE_PROMPT
  };
}

export function buildSimpleBuyVsRentConclusionText(core: SimpleBuyVsRentCoreResult): string {
  return generateSimpleBuyVsRentConclusion(core.summary, core.inputs);
}

function summaryMetric(key: string, label: string, unit: "currency" | "percent" | "number", value: number | null): SummaryMetric {
  if (value == null || !Number.isFinite(value)) {
    return { key, label, unit, value: null, formatted: "—" };
  }
  const formatted =
    unit === "currency" ? formatCurrency(value) : unit === "percent" ? formatPercent(value) : String(round2(value));
  return { key, label, unit, value: round2(value), formatted };
}

/** Map core model output to the shared `CalculatorResult` contract for the UI. */
export function mapSimpleBuyVsRentToCalculatorResult(
  core: SimpleBuyVsRentCoreResult,
  scenarioName?: string
): CalculatorResult {
  const { summary: s, yearRows, inputs } = core;
  const year0Buy = round2(inputs.purchasePrice - (inputs.purchasePrice - core.bondAmount));
  const year0Rent = core.initialCashAvailableToInvestIfRenting;

  const positionLabels = ["Year 0", ...yearRows.map((r) => `Year ${r.year}`)];
  const buyPositionSeries = [year0Buy, ...yearRows.map((r) => r.netBuyingPosition)];
  const rentPositionSeries = [year0Rent, ...yearRows.map((r) => r.netRentingPosition)];

  const summaryMetrics: SummaryMetric[] = [
    summaryMetric("betterOption", "Better option", "number", null),
    summaryMetric("differenceAfterPeriod", "Difference after period", "currency", s.differenceAfterPeriod),
    summaryMetric("netBuyingPositionEnd", "Estimated home equity", "currency", s.netBuyingPositionEnd),
    summaryMetric("netRentingPositionEnd", "Estimated renting investment", "currency", s.netRentingPositionEnd),
    summaryMetric("breakEvenYear", "Break-even year", "number", s.breakEvenYear)
  ];
  summaryMetrics[0] = {
    key: "betterOption",
    label: "Better option",
    unit: "number",
    value: null,
    formatted: s.betterOptionLabel
  };
  if (s.breakEvenYear != null) {
    summaryMetrics[4] = {
      key: "breakEvenYear",
      label: "Break-even",
      unit: "number",
      value: s.breakEvenYear,
      formatted: s.breakEvenHeadline
    };
  } else {
    summaryMetrics[4] = {
      key: "breakEvenYear",
      label: "Break-even",
      unit: "number",
      value: null,
      formatted: s.breakEvenHeadline
    };
  }

  const assumptions = simpleBuyVsRentAssumptionsPayload();

  return {
    calculator: "buy-vs-rent",
    scenarioName,
    summary: summaryMetrics,
    breakdown: {
      simple: core,
      verdict: s.verdict,
      betterOptionLabel: s.betterOptionLabel,
      comparisonTable: core.comparisonTable,
      yearRows,
      bondAmount: core.bondAmount,
      monthlyBondPayment: core.monthlyBondPayment,
      upfrontBuyingCosts: core.upfrontBuyingCosts,
      netAdvantageBuy: s.differenceAfterPeriod,
      buyEquityEnd: s.netBuyingPositionEnd,
      rentWealthEnd: s.netRentingPositionEnd
    },
    interpretation: {
      text: buildSimpleBuyVsRentConclusionText(core),
      warnings: core.warnings
    },
    chartData: [
      {
        chartType: "line",
        title: "Net position over time",
        data: {
          labels: positionLabels,
          datasets: [
            { label: "Buying position", data: buyPositionSeries },
            { label: "Renting position", data: rentPositionSeries }
          ]
        }
      },
      {
        chartType: "bar",
        title: "Final net position",
        data: {
          labels: ["Buy", "Rent"],
          datasets: [
            {
              label: "Estimated net position (ZAR)",
              data: [s.netBuyingPositionEnd, s.netRentingPositionEnd]
            }
          ]
        }
      }
    ],
    assumptionsUsed: {
      assumptions: assumptions.assumptions,
      note: assumptions.note,
      upgradePrompt: assumptions.upgradePrompt
    }
  };
}
