import type { PropertyFinancialOverview } from "../properties/financials/propertyFinancialsAdapter";

/** Canonical property-level financial summary consumed by overview, financials, and reports. */
export type PropertyFinancialSummary = {
  propertyId: string;
  purchasePrice: number | null;
  marketValue: number | null;
  loanBalance: number | null;
  cashInvested: number | null;
  equity: number | null;
  monthlyIncome: number;
  monthlyOperatingExpenses: number;
  monthlyDebtService: number;
  monthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCashRoi: number | null;
  grossYield: number | null;
  netYield: number | null;
  occupiedUnits: number;
  totalUnits: number;
  occupancyRate: number | null;
  unitsOccupiedDisplay: string;
  receivedThisMonth: number;
  expectedThisMonth: number;
  overview: PropertyFinancialOverview;
};
