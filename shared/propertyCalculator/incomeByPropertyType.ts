import type { CalculatorPropertyTypeId, NormalizedPropertyCalculatorInput } from "./calculatorTypes";
import { clampPct, round2, sumNullable } from "./financialMetrics";

export type IncomeComputation = {
  grossMonthlyIncome: number | null;
  effectiveMonthlyIncome: number | null;
  typeSpecificOperatingExpense: number;
  unitsOccupied: number | null;
  totalUnits: number | null;
  occupancyRate: number | null;
  missingInputs: string[];
};

function applyVacancy(gross: number, vacancyPct: number | null): number {
  const vacancy = vacancyPct ?? 0;
  return gross * (1 - vacancy / 100);
}

function applyPercentExpense(baseIncome: number, pct: number | null): number {
  if (!(baseIncome > 0) || pct == null || !Number.isFinite(pct)) return 0;
  return (baseIncome * pct) / 100;
}

export function computeIncomeByPropertyType(input: NormalizedPropertyCalculatorInput): IncomeComputation {
  const missingInputs: string[] = [];
  const vacancyPct = clampPct(input.vacancyAllowancePct);
  let grossMonthlyIncome: number | null = null;
  let typeSpecificOperatingExpense = 0;
  let unitsOccupied: number | null = null;
  let totalUnits: number | null = null;
  let occupancyRate: number | null = null;

  if (input.dataSource === "portfolio" && input.monthlyRent != null && input.monthlyRent > 0) {
    grossMonthlyIncome = input.monthlyRent;
    totalUnits = input.totalUnits ?? 1;
    unitsOccupied =
      input.unitsOccupied != null ? Math.min(input.unitsOccupied, totalUnits) : totalUnits > 0 ? 1 : 0;
    occupancyRate = totalUnits > 0 ? round2((unitsOccupied / totalUnits) * 100) : null;
    const effectiveMonthlyIncome = round2(applyVacancy(grossMonthlyIncome, vacancyPct));
    return {
      grossMonthlyIncome,
      effectiveMonthlyIncome,
      typeSpecificOperatingExpense,
      unitsOccupied,
      totalUnits,
      occupancyRate,
      missingInputs
    };
  }

  const type = input.propertyType;

  if (type === "single-family") {
    const rent = input.monthlyRent;
    if (rent == null || rent <= 0) missingInputs.push("monthlyRent");
    else grossMonthlyIncome = rent;
    unitsOccupied = 1;
    totalUnits = 1;
    occupancyRate = 100;
  } else if (type === "duplex") {
    const u1 = input.unit1Occupied ? input.unit1Rent ?? 0 : 0;
    const u2 = input.unit2Occupied ? input.unit2Rent ?? 0 : 0;
    const gross = u1 + u2;
    if (gross <= 0) missingInputs.push("unit1Rent", "unit2Rent");
    else grossMonthlyIncome = gross;
    unitsOccupied = (input.unit1Occupied ? 1 : 0) + (input.unit2Occupied ? 1 : 0);
    totalUnits = 2;
    occupancyRate = totalUnits > 0 ? round2((unitsOccupied / totalUnits) * 100) : null;
  } else if (type === "apartment") {
    const rent = input.monthlyRent;
    const occ = clampPct(input.occupancyRatePct);
    const occRate = occ != null ? occ / 100 : 1;
    if (rent == null || rent <= 0) missingInputs.push("monthlyRent");
    else grossMonthlyIncome = rent * occRate;
    unitsOccupied = occ != null ? Math.round(occ) : 1;
    totalUnits = 100;
    occupancyRate = occ;
  } else if (type === "multi-family") {
    const units = input.numberOfUnits;
    const avgRent = input.averageRentPerUnit;
    const occ = clampPct(input.occupancyRatePct);
    const occRate = occ != null ? occ / 100 : 1;
    if (units == null || avgRent == null) missingInputs.push("numberOfUnits", "averageRentPerUnit");
    else grossMonthlyIncome = units * avgRent * occRate;
    unitsOccupied = units != null ? Math.round((units * (occRate ?? 0)) || 0) : null;
    totalUnits = units != null ? Math.round(units) : null;
    occupancyRate = occ;
  } else if (type === "student-housing") {
    const beds = input.bedsOrRooms;
    const rentPer = input.rentPerBed;
    const occ = clampPct(input.occupancyRatePct);
    const occRate = occ != null ? occ / 100 : 1;
    if (beds == null || rentPer == null) missingInputs.push("bedsOrRooms", "rentPerBed");
    else grossMonthlyIncome = beds * rentPer * occRate;
    unitsOccupied = beds != null ? Math.round((beds * occRate) || 0) : null;
    totalUnits = beds != null ? Math.round(beds) : null;
    occupancyRate = occ;
  } else if (type === "airbnb") {
    const nightly = input.nightlyRate;
    const occ = clampPct(input.occupancyRatePct);
    const nights = input.bookedNightsPerMonth;
    const cleaningIncome = input.cleaningIncome ?? 0;
    let nightsBooked: number | null = null;
    if (nights != null) nightsBooked = nights;
    else if (occ != null) nightsBooked = (occ / 100) * 30;
    if (nightly == null || nightsBooked == null) {
      missingInputs.push("nightlyRate", "bookedNightsPerMonth");
    } else {
      grossMonthlyIncome = nightly * nightsBooked + cleaningIncome;
      const platformFees = applyPercentExpense(grossMonthlyIncome, input.platformFeesPct);
      typeSpecificOperatingExpense += platformFees;
      unitsOccupied = Math.round(nightsBooked);
      totalUnits = 30;
      occupancyRate = occ;
    }
  } else if (type === "commercial") {
    const income = input.monthlyLeaseIncome ?? input.monthlyRent;
    if (income == null || income <= 0) missingInputs.push("monthlyLeaseIncome");
    else grossMonthlyIncome = income;
    unitsOccupied = 1;
    totalUnits = 1;
    occupancyRate = 100;
  } else if (type === "vacant-land") {
    grossMonthlyIncome = null;
    unitsOccupied = null;
    totalUnits = null;
    occupancyRate = null;
  }

  const effectiveMonthlyIncome =
    grossMonthlyIncome == null ? null : round2(applyVacancy(grossMonthlyIncome, vacancyPct));

  return {
    grossMonthlyIncome,
    effectiveMonthlyIncome,
    typeSpecificOperatingExpense,
    unitsOccupied,
    totalUnits,
    occupancyRate,
    missingInputs
  };
}

export function isVacantLandType(type: CalculatorPropertyTypeId): boolean {
  return type === "vacant-land";
}
