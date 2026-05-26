export type SimpleBuyVsRentVerdict = "buy" | "rent" | "close";

export type SimpleBuyVsRentBetterOption = "buy" | "rent" | "tie";

export type SimpleBuyVsRentInputs = {
  purchasePrice: number;
  monthlyRent: number;
  depositAmount: number;
  interestRate: number;
  analysisYears: number;
  propertyAppreciation: number;
  rentEscalation: number;
  scenarioName?: string;
};

export type SimpleBuyVsRentYearRow = {
  year: number;
  propertyValue: number;
  outstandingBond: number;
  netBuyingPosition: number;
  netRentingPosition: number;
  annualOwnershipCashOut: number;
  annualRentingCashOut: number;
  cumulativeBuyingCashPaid: number;
  cumulativeRentPaid: number;
  difference: number;
  betterOption: SimpleBuyVsRentBetterOption;
};

export type SimpleBuyVsRentComparisonTable = {
  finalPositionBuy: number;
  finalPositionRent: number;
  startingMonthlyCostBuy: number;
  startingMonthlyCostRent: number;
  totalPaidBuy: number;
  totalPaidRent: number;
  betterFinalPosition: "buy" | "rent" | "tie";
};

export type SimpleBuyVsRentSummary = {
  betterOptionLabel: string;
  differenceHeadline: string;
  homeEquityHeadline: string;
  rentingInvestmentHeadline: string;
  breakEvenHeadline: string;
  verdict: SimpleBuyVsRentVerdict;
  differenceAfterPeriod: number;
  netBuyingPositionEnd: number;
  netRentingPositionEnd: number;
  breakEvenYear: number | null;
};

export type SimpleBuyVsRentCoreResult = {
  inputs: SimpleBuyVsRentInputs;
  bondAmount: number;
  monthlyBondPayment: number;
  upfrontBuyingCosts: number;
  buyerInitialCashOut: number;
  renterInitialCashOut: number;
  initialCashAvailableToInvestIfRenting: number;
  yearRows: SimpleBuyVsRentYearRow[];
  summary: SimpleBuyVsRentSummary;
  comparisonTable: SimpleBuyVsRentComparisonTable;
  warnings: string[];
};
