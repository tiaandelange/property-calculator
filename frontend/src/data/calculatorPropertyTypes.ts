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

