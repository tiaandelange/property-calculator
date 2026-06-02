import type { PropertyTypeId } from "./calculatorPropertyTypes";

export type CalculatorQuestionFieldType =
  | "currency"
  | "percentage"
  | "integer"
  | "decimal"
  | "dropdown"
  | "toggle"
  | "text";

export type CalculatorQuestionOption = { value: string; label: string };

export type CalculatorQuestionDef = {
  key: string;
  type: CalculatorQuestionFieldType;
  label: string;
  helper?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  options?: CalculatorQuestionOption[];
  /** Optional formatter for summary/preview (display only) */
  formatter?: "currency" | "percentage" | "number";
};

export type CalculatorQuestionSection = {
  sectionLabel: string;
  fields: CalculatorQuestionDef[];
};

export type PropertyTypeQuestionConfig = {
  propertyType: PropertyTypeId;
  sections: CalculatorQuestionSection[];
};

const purchaseAndValue: CalculatorQuestionDef[] = [
  { key: "purchasePrice", type: "currency", label: "Purchase Price", required: true, formatter: "currency", placeholder: "e.g. 1 450 000" },
  { key: "marketValue", type: "currency", label: "Market Value (Estimated)", formatter: "currency", placeholder: "Optional" },
  { key: "closingCosts", type: "currency", label: "Closing / Transfer Costs", formatter: "currency" },
  { key: "repairsRenovation", type: "currency", label: "Repairs / Renovation Costs", formatter: "currency" }
];

const financing: CalculatorQuestionDef[] = [
  { key: "cashInvested", type: "currency", label: "Deposit / Cash Invested", formatter: "currency" },
  { key: "loanAmount", type: "currency", label: "Loan Amount", formatter: "currency" },
  { key: "interestRateApr", type: "percentage", label: "Interest Rate (APR)", required: true, formatter: "percentage", placeholder: "e.g. 11.25" },
  { key: "loanTermYears", type: "integer", label: "Loan Term (Years)", defaultValue: 20, formatter: "number" },
  { key: "amortizationYears", type: "integer", label: "Amortization Period (Years)", helper: "If different to loan term.", formatter: "number" }
];

const baselineExpenses: CalculatorQuestionDef[] = [
  { key: "ratesTaxesMonthly", type: "currency", label: "Property Taxes / Rates (Monthly)", formatter: "currency" },
  { key: "insuranceMonthly", type: "currency", label: "Insurance (Monthly)", formatter: "currency" },
  { key: "maintenanceReserveMonthly", type: "currency", label: "Maintenance Reserve (Monthly)", formatter: "currency" },
  { key: "managementFeePct", type: "percentage", label: "Management Fee (%)", formatter: "percentage" },
  { key: "vacancyAllowancePct", type: "percentage", label: "Vacancy Allowance (%)", formatter: "percentage", defaultValue: 5 }
];

export const CALCULATOR_QUESTION_CONFIGS: Record<PropertyTypeId, PropertyTypeQuestionConfig> = {
  "single-family": {
    propertyType: "single-family",
    sections: [
      { sectionLabel: "Purchase & Value", fields: purchaseAndValue },
      { sectionLabel: "Income", fields: [{ key: "monthlyRent", type: "currency", label: "Monthly Rent", required: true, formatter: "currency" }] },
      { sectionLabel: "Financing", fields: financing },
      { sectionLabel: "Operating Expenses", fields: baselineExpenses }
    ]
  },

  duplex: {
    propertyType: "duplex",
    sections: [
      { sectionLabel: "Purchase & Value", fields: purchaseAndValue },
      {
        sectionLabel: "Income (by unit)",
        fields: [
          { key: "unit1Rent", type: "currency", label: "Monthly Rent — Unit 1", required: true, formatter: "currency" },
          { key: "unit2Rent", type: "currency", label: "Monthly Rent — Unit 2", required: true, formatter: "currency" },
          { key: "unit1Occupied", type: "toggle", label: "Unit 1 occupied?", defaultValue: true },
          { key: "unit2Occupied", type: "toggle", label: "Unit 2 occupied?", defaultValue: true }
        ]
      },
      { sectionLabel: "Financing", fields: financing },
      { sectionLabel: "Operating Expenses (shared)", fields: baselineExpenses }
    ]
  },

  apartment: {
    propertyType: "apartment",
    sections: [
      { sectionLabel: "Purchase & Value", fields: purchaseAndValue },
      {
        sectionLabel: "Income",
        fields: [
          { key: "monthlyRent", type: "currency", label: "Monthly Rent", required: true, formatter: "currency" },
          { key: "occupancyPct", type: "percentage", label: "Occupancy (%)", defaultValue: 95, formatter: "percentage" }
        ]
      },
      {
        sectionLabel: "Apartment costs",
        fields: [
          { key: "hoaLeviesMonthly", type: "currency", label: "HOA / Levies / Body Corporate", formatter: "currency" },
          { key: "utilitiesLandlordPaid", type: "toggle", label: "Utilities paid by landlord?", defaultValue: false },
          { key: "utilitiesMonthly", type: "currency", label: "Utilities (Monthly)", formatter: "currency" }
        ]
      },
      { sectionLabel: "Financing", fields: financing },
      { sectionLabel: "Operating Expenses", fields: baselineExpenses }
    ]
  },

  "multi-family": {
    propertyType: "multi-family",
    sections: [
      { sectionLabel: "Purchase & Value", fields: purchaseAndValue },
      {
        sectionLabel: "Units & income",
        fields: [
          { key: "unitCount", type: "integer", label: "Number of Units", required: true, formatter: "number", defaultValue: 4 },
          { key: "avgRentPerUnit", type: "currency", label: "Average Monthly Rent per Unit", required: true, formatter: "currency" },
          { key: "occupancyPct", type: "percentage", label: "Occupancy (%)", defaultValue: 92, formatter: "percentage" }
        ]
      },
      { sectionLabel: "Financing", fields: financing },
      {
        sectionLabel: "Operating Expenses",
        fields: [
          ...baselineExpenses,
          { key: "utilitiesMonthly", type: "currency", label: "Utilities (Monthly)", formatter: "currency" }
        ]
      }
    ]
  },

  "student-housing": {
    propertyType: "student-housing",
    sections: [
      { sectionLabel: "Purchase & Value", fields: purchaseAndValue },
      {
        sectionLabel: "Beds & income",
        fields: [
          { key: "bedCount", type: "integer", label: "Number of Beds / Rooms", required: true, formatter: "number", defaultValue: 6 },
          { key: "rentPerBed", type: "currency", label: "Rent per Bed / Room", required: true, formatter: "currency" },
          { key: "occupancyPct", type: "percentage", label: "Occupancy (%)", defaultValue: 90, formatter: "percentage" },
          { key: "turnoverVacancyPct", type: "percentage", label: "Turnover / Vacancy (%)", helper: "Extra vacancy due to changeovers.", defaultValue: 5, formatter: "percentage" }
        ]
      },
      { sectionLabel: "Financing", fields: financing },
      {
        sectionLabel: "Operating Expenses",
        fields: [
          ...baselineExpenses,
          { key: "utilitiesMonthly", type: "currency", label: "Utilities (Monthly)", formatter: "currency" },
          { key: "internetCommonMonthly", type: "currency", label: "Internet / common services (Monthly)", formatter: "currency" },
          { key: "furnishingAllowanceMonthly", type: "currency", label: "Furnishing / replacement allowance", formatter: "currency" }
        ]
      }
    ]
  },

  airbnb: {
    propertyType: "airbnb",
    sections: [
      { sectionLabel: "Purchase & Value", fields: purchaseAndValue },
      {
        sectionLabel: "Short-term rental income",
        fields: [
          { key: "avgNightlyRate", type: "currency", label: "Average Nightly Rate", required: true, formatter: "currency" },
          { key: "occupancyRatePct", type: "percentage", label: "Occupancy Rate (%)", required: true, formatter: "percentage", defaultValue: 65 },
          { key: "avgNightsBookedPerMonth", type: "decimal", label: "Average Nights Booked / Month", formatter: "number", defaultValue: 20 },
          { key: "cleaningFeeIncomeMonthly", type: "currency", label: "Cleaning Fee Income (Monthly)", formatter: "currency" }
        ]
      },
      {
        sectionLabel: "Short-term rental costs",
        fields: [
          { key: "cleaningCostsMonthly", type: "currency", label: "Cleaning Costs (Monthly)", formatter: "currency" },
          { key: "platformFeesPct", type: "percentage", label: "Platform Fees (%)", defaultValue: 3, formatter: "percentage" },
          { key: "consumablesMonthly", type: "currency", label: "Consumables / Restocking (Monthly)", formatter: "currency" }
        ]
      },
      { sectionLabel: "Financing", fields: financing },
      {
        sectionLabel: "Operating Expenses",
        fields: [
          ...baselineExpenses,
          { key: "utilitiesMonthly", type: "currency", label: "Utilities (Monthly)", formatter: "currency" }
        ]
      }
    ]
  },

  commercial: {
    propertyType: "commercial",
    sections: [
      { sectionLabel: "Purchase & Value", fields: purchaseAndValue },
      {
        sectionLabel: "Lease income",
        fields: [
          { key: "monthlyLeaseIncome", type: "currency", label: "Monthly Rental Income", required: true, formatter: "currency" },
          { key: "leaseTermMonths", type: "integer", label: "Lease Term (Months)", defaultValue: 36, formatter: "number" },
          { key: "leaseStructure", type: "dropdown", label: "Lease structure", defaultValue: "gross", options: [
            { value: "gross", label: "Gross" },
            { value: "nnn", label: "NNN (triple net)" }
          ] }
        ]
      },
      { sectionLabel: "Financing", fields: financing },
      {
        sectionLabel: "Operating Expenses",
        fields: [
          ...baselineExpenses,
          { key: "operatingExpensesMonthly", type: "currency", label: "Operating expenses (Monthly)", formatter: "currency" },
          { key: "camMonthly", type: "currency", label: "Maintenance / CAM (Monthly)", formatter: "currency" }
        ]
      }
    ]
  },

  "vacant-land": {
    propertyType: "vacant-land",
    sections: [
      { sectionLabel: "Purchase & Value", fields: purchaseAndValue },
      {
        sectionLabel: "Holding & growth",
        fields: [
          { key: "holdingCostsMonthly", type: "currency", label: "Holding costs (Monthly)", formatter: "currency" },
          { key: "ratesTaxesMonthly", type: "currency", label: "Rates/Taxes (Monthly)", formatter: "currency" },
          { key: "expectedAppreciationPct", type: "percentage", label: "Expected appreciation (%)", formatter: "percentage", defaultValue: 8 },
          { key: "developmentNotes", type: "text", label: "Development potential notes", helper: "Optional notes for future expansion." },
          { key: "developmentCosts", type: "currency", label: "Optional development costs", formatter: "currency" }
        ]
      },
      { sectionLabel: "Financing", fields: financing }
    ]
  }
};

export function getQuestionConfig(propertyType: PropertyTypeId): PropertyTypeQuestionConfig {
  return CALCULATOR_QUESTION_CONFIGS[propertyType];
}

export function getDefaultAnswersForConfig(config: PropertyTypeQuestionConfig): Record<string, string> {
  const next: Record<string, string> = {};
  for (const section of config.sections) {
    for (const f of section.fields) {
      if (f.defaultValue === undefined) continue;
      next[f.key] = typeof f.defaultValue === "string" ? f.defaultValue : String(f.defaultValue);
    }
  }
  return next;
}

