import type { CalculatorPropertyTypeId } from "@propertyCalculator/calculatorTypes";
import type { PropertyTypeId } from "../../data/calculatorPropertyTypes";

const STRUCTURE_TO_CALCULATOR: Record<string, CalculatorPropertyTypeId> = {
  single_family_house: "single-family",
  townhouse: "single-family",
  duplex: "duplex",
  apartment: "apartment",
  multi_family: "multi-family",
  student_accommodation: "student-housing",
  short_term_rental: "airbnb",
  commercial: "commercial",
  vacant_land: "vacant-land",
  land: "vacant-land"
};

export function calculatorPropertyTypeFromStructure(
  structureTypeId: string | null | undefined,
  investmentType?: string | null
): CalculatorPropertyTypeId {
  const structure = String(structureTypeId ?? "").trim();
  if (structure && STRUCTURE_TO_CALCULATOR[structure]) {
    return STRUCTURE_TO_CALCULATOR[structure];
  }
  const inv = String(investmentType ?? "").toUpperCase();
  if (inv === "SHORT_TERM_RENTAL") return "airbnb";
  if (inv === "COMMERCIAL") return "commercial";
  if (inv === "VACANT_LAND" || inv === "LAND") return "vacant-land";
  return "single-family";
}

export function toCalculatorPropertyTypeId(propertyType: PropertyTypeId): CalculatorPropertyTypeId {
  return propertyType;
}
