import type { IconName } from "../components/icons";

export type CalculatorCategory =
  | "rental-long-term"
  | "rental-multi-unit"
  | "student"
  | "short-term"
  | "commercial"
  | "land";

export type PropertyTypeId =
  | "single-family"
  | "duplex"
  | "apartment"
  | "multi-family"
  | "student-housing"
  | "airbnb"
  | "commercial"
  | "vacant-land";

export type PropertyTypeDef = {
  propertyType: PropertyTypeId;
  label: string;
  /** 3–4 word description */
  description: string;
  icon: IconName;
  calculatorCategory: CalculatorCategory;
  questionsConfigKey: string;
};

export const PROPERTY_TYPES: PropertyTypeDef[] = [
  {
    propertyType: "single-family",
    label: "Single Family",
    description: "Standalone home rental",
    icon: "property",
    calculatorCategory: "rental-long-term",
    questionsConfigKey: "singleFamily"
  },
  {
    propertyType: "duplex",
    label: "Duplex",
    description: "Two Unit Property",
    icon: "units",
    calculatorCategory: "rental-multi-unit",
    questionsConfigKey: "duplex"
  },
  {
    propertyType: "apartment",
    label: "Apartment",
    description: "Levies & occupancy",
    icon: "unit",
    calculatorCategory: "rental-long-term",
    questionsConfigKey: "apartment"
  },
  {
    propertyType: "multi-family",
    label: "Multi-Family",
    description: "Many units averaged",
    icon: "portfolio",
    calculatorCategory: "rental-multi-unit",
    questionsConfigKey: "multiFamily"
  },
  {
    propertyType: "student-housing",
    label: "Student Housing",
    description: "Beds, utilities, churn",
    icon: "tenants",
    calculatorCategory: "student",
    questionsConfigKey: "studentHousing"
  },
  {
    propertyType: "airbnb",
    label: "Airbnb / Short Term Rental",
    description: "Nightly rate & fees",
    icon: "fast",
    calculatorCategory: "short-term",
    questionsConfigKey: "airbnb"
  },
  {
    propertyType: "commercial",
    label: "Commercial",
    description: "Lease type & vacancy",
    icon: "reports",
    calculatorCategory: "commercial",
    questionsConfigKey: "commercial"
  },
  {
    propertyType: "vacant-land",
    label: "Vacant Land",
    description: "Holding & appreciation",
    icon: "tools",
    calculatorCategory: "land",
    questionsConfigKey: "vacantLand"
  }
] as const;

export type QuestionFieldType = "money" | "percent" | "number" | "text" | "select";

export type QuestionDef = {
  key: string;
  label: string;
  type: QuestionFieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export const QUESTIONS_BY_KEY: Record<string, QuestionDef[]> = {
  singleFamily: [
    { key: "purchasePrice", label: "Purchase price (R)", type: "money", placeholder: "e.g. 1 450 000" },
    { key: "monthlyRent", label: "Monthly rent (R)", type: "money", placeholder: "e.g. 12 500" },
    { key: "monthlyExpenses", label: "Monthly expenses (R)", type: "money", placeholder: "e.g. 3 200" },
    { key: "depositPct", label: "Deposit (%)", type: "percent", placeholder: "e.g. 10" },
    { key: "interestRatePct", label: "Interest rate (%)", type: "percent", placeholder: "e.g. 11.25" },
    { key: "loanTermYears", label: "Loan term (years)", type: "number", placeholder: "e.g. 20" }
  ],
  duplex: [
    { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
    { key: "unit1Rent", label: "Unit 1 rent (R)", type: "money" },
    { key: "unit2Rent", label: "Unit 2 rent (R)", type: "money" },
    { key: "monthlyExpenses", label: "Monthly expenses (R)", type: "money" },
    { key: "depositPct", label: "Deposit (%)", type: "percent" }
  ],
  apartment: [
    { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
    { key: "monthlyRent", label: "Monthly rent (R)", type: "money" },
    { key: "monthlyLevies", label: "Levies / body corporate (R)", type: "money" },
    { key: "occupancyPct", label: "Occupancy (%)", type: "percent", placeholder: "e.g. 95" },
    { key: "monthlyExpenses", label: "Other monthly expenses (R)", type: "money" }
  ],
  multiFamily: [
    { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
    { key: "unitCount", label: "Number of units", type: "number", placeholder: "e.g. 12" },
    { key: "avgRentPerUnit", label: "Average rent per unit (R)", type: "money" },
    { key: "occupancyPct", label: "Occupancy (%)", type: "percent" },
    { key: "monthlyExpenses", label: "Monthly operating expenses (R)", type: "money" }
  ],
  studentHousing: [
    { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
    { key: "bedCount", label: "Beds / rooms", type: "number" },
    { key: "rentPerBed", label: "Rent per bed/room (R)", type: "money" },
    { key: "utilitiesMonthly", label: "Utilities (R / month)", type: "money" },
    { key: "occupancyPct", label: "Occupancy (%)", type: "percent" }
  ],
  airbnb: [
    { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
    { key: "nightlyRate", label: "Nightly rate (R)", type: "money" },
    { key: "occupancyPct", label: "Occupancy rate (%)", type: "percent" },
    { key: "nightsBooked", label: "Nights booked (per month)", type: "number" },
    { key: "cleaningIncome", label: "Cleaning income (R / month)", type: "money" },
    { key: "cleaningCosts", label: "Cleaning costs (R / month)", type: "money" },
    { key: "platformFeesPct", label: "Platform fees (%)", type: "percent" }
  ],
  commercial: [
    { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
    { key: "leaseIncome", label: "Monthly lease income (R)", type: "money" },
    { key: "operatingExpenses", label: "Operating expenses (R / month)", type: "money" },
    { key: "vacancyPct", label: "Vacancy (%)", type: "percent" },
    {
      key: "leaseType",
      label: "Lease type",
      type: "select",
      options: [
        { value: "gross", label: "Gross lease" },
        { value: "net", label: "Net lease" },
        { value: "triple-net", label: "Triple net (NNN)" }
      ]
    }
  ],
  vacantLand: [
    { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
    { key: "monthlyHoldingCosts", label: "Holding costs (R / month)", type: "money" },
    { key: "annualAppreciationPct", label: "Annual appreciation (%)", type: "percent" },
    { key: "developmentCosts", label: "Development costs (R)", type: "money" }
  ]
} as const;

