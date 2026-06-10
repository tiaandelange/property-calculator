/** Calculator property types (investment report / calculators hub). */
export type CalculatorPropertyTypeId =
  | "single-family"
  | "duplex"
  | "apartment"
  | "multi-family"
  | "student-housing"
  | "airbnb"
  | "commercial"
  | "vacant-land";

export type CalculatorDataSource = "calculator-form" | "portfolio";

/** Normalized inputs — all monetary fields are monthly unless noted. */
export type NormalizedPropertyCalculatorInput = {
  propertyType: CalculatorPropertyTypeId;
  dataSource?: CalculatorDataSource;

  purchasePrice: number | null;
  marketValue: number | null;
  closingCosts: number | null;
  repairsRenovation: number | null;
  cashInvested: number | null;
  loanAmount: number | null;
  loanBalance: number | null;
  interestRateApr: number | null;
  loanTermYears: number | null;
  monthlyLoanPayment: number | null;

  /** Portfolio rent roll or calculator monthly rent (before vacancy). */
  monthlyRent: number | null;
  unit1Rent: number | null;
  unit2Rent: number | null;
  unit1Occupied: boolean;
  unit2Occupied: boolean;
  numberOfUnits: number | null;
  averageRentPerUnit: number | null;
  bedsOrRooms: number | null;
  rentPerBed: number | null;
  nightlyRate: number | null;
  occupancyRatePct: number | null;
  bookedNightsPerMonth: number | null;
  cleaningIncome: number | null;
  monthlyLeaseIncome: number | null;

  cleaningCosts: number | null;
  platformFeesPct: number | null;
  ratesTaxesMonthly: number | null;
  insuranceMonthly: number | null;
  maintenanceMonthly: number | null;
  managementFeePct: number | null;
  leviesMonthly: number | null;
  utilitiesMonthly: number | null;
  otherExpensesMonthly: number | null;
  holdingCostsMonthly: number | null;
  vacancyAllowancePct: number | null;

  annualRentGrowthPct: number | null;
  annualExpenseGrowthPct: number | null;
  annualPropertyGrowthPct: number | null;
  holdingPeriodYears: number | null;
  /** Selling costs as % of projected sale price (defaults to 0). */
  sellingCostPct: number | null;

  /** When set (portfolio), operating expenses are taken as-is instead of recomputing from line items. */
  monthlyOperatingExpensesOverride: number | null;
  monthlyDebtServiceOverride: number | null;

  /** Portfolio occupancy hints (optional). */
  unitsOccupied?: number | null;
  totalUnits?: number | null;
};

export type IrrByYearEntry = {
  year: number;
  irr: number | null;
  exitValue: number | null;
  cashFlows: number[];
};

export type ProjectedYearSeries = {
  years: number[];
  income: number[];
  expenses: number[];
  cashFlow: number[];
  propertyValue: number[];
  loanBalance: number[];
  equity: number[];
};

export type PropertyCalculatorResult = {
  monthlyIncome: number | null;
  effectiveMonthlyIncome: number | null;
  monthlyExpenses: number | null;
  monthlyLoanPayment: number | null;
  monthlyCashFlow: number | null;
  annualIncome: number | null;
  annualExpenses: number | null;
  annualCashFlow: number | null;
  grossYield: number | null;
  netYield: number | null;
  cashOnCashRoi: number | null;
  equity: number | null;
  ltv: number | null;
  capRate: number | null;
  /** Default IRR (holding period or closest projection year, usually Year 10). */
  irr: number | null;
  irrByYear: IrrByYearEntry[];
  occupancyRate: number | null;
  unitsOccupied: number | null;
  totalUnits: number | null;
  totalProjectCost: number | null;
  projectedYears: number[];
  projectedIncome: number[];
  projectedExpenses: number[];
  projectedCashFlow: number[];
  projectedPropertyValue: number[];
  projectedLoanBalance: number[];
  projectedEquity: number[];
  fiftyPercentRule: number | null;
  twoPercentRule: number | null;
  investmentRating: "excellent" | "good" | "fair" | "weak" | null;
  warnings: string[];
  missingInputs: string[];
};
