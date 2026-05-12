import type { Prisma } from "@prisma/client";
import { asNumber } from "./property.dto.helpers.js";
import { isAllowedBondTermYears } from "./property.bond.helpers.js";

/**
 * Creates only the Property core row — no ledger rows, tenants, or leases.
 */
export function buildPropertyCreateInput(body: Record<string, unknown>, userId: number): Prisma.PropertyCreateInput {
  return {
    owner: { connect: { id: userId } },
    name: String(body.name ?? ""),
    propertyType: body.propertyType as any,
    investmentType: (body.investmentType as any) ?? "LONG_TERM_RENTAL",
    addressLine1: String(body.addressLine1 ?? ""),
    addressLine2: body.addressLine2 != null ? String(body.addressLine2) : null,
    suburb: body.suburb != null ? String(body.suburb) : null,
    city: String(body.city ?? ""),
    province: String(body.province ?? ""),
    postalCode: body.postalCode != null ? String(body.postalCode) : null,
    country: body.country != null ? String(body.country) : "South Africa",
    erfNumber: body.erfNumber != null ? String(body.erfNumber) : null,
    sizeSqm: body.sizeSqm != null ? asNumber(body.sizeSqm) : null,
    bedrooms: body.bedrooms != null ? Number(body.bedrooms) : null,
    bathrooms: body.bathrooms != null ? Number(body.bathrooms) : null,
    parkingBays: body.parkingBays != null ? Number(body.parkingBays) : null,
    purchasePrice: asNumber(body.purchasePrice),
    purchaseDate: body.purchaseDate ? new Date(String(body.purchaseDate)) : null,
    currentEstimatedValue: body.currentEstimatedValue != null ? asNumber(body.currentEstimatedValue) : null,
    outstandingBondBalance: body.outstandingBondBalance != null ? asNumber(body.outstandingBondBalance) : null,
    monthlyBondPayment: body.monthlyBondPayment != null ? asNumber(body.monthlyBondPayment) : null,
    bondAnnualInterestRatePercent:
      body.bondAnnualInterestRatePercent != null ? asNumber(body.bondAnnualInterestRatePercent) : null,
    bondTermYears:
      body.bondTermYears != null && isAllowedBondTermYears(body.bondTermYears) ? Number(body.bondTermYears) : null,
    bondStartDate: body.bondStartDate ? new Date(String(body.bondStartDate)) : null,
    bondRemainingTermMonths: body.bondRemainingTermMonths != null ? Number(body.bondRemainingTermMonths) : null,
    bondInterestPortionOverride:
      body.bondInterestPortionOverride != null ? asNumber(body.bondInterestPortionOverride) : null,
    bondPrincipalPortionOverride:
      body.bondPrincipalPortionOverride != null ? asNumber(body.bondPrincipalPortionOverride) : null,
    totalCashInvested: body.totalCashInvested != null ? asNumber(body.totalCashInvested) : null,
    bondCosts: body.bondCosts != null ? asNumber(body.bondCosts) : null,
    transferCosts: body.transferCosts != null ? asNumber(body.transferCosts) : null,
    holdingPeriodYears: body.holdingPeriodYears != null ? Number(body.holdingPeriodYears) : null,
    estimatedSellingCostPercent: body.estimatedSellingCostPercent != null ? asNumber(body.estimatedSellingCostPercent) : null,
    expectedMonthlyIncome: body.expectedMonthlyIncome != null ? asNumber(body.expectedMonthlyIncome) : null,
    expectedMonthlyExpenses: body.expectedMonthlyExpenses != null ? asNumber(body.expectedMonthlyExpenses) : null,
    status: body.status != null ? String(body.status) : null,
    notes: body.notes != null ? String(body.notes) : null,

    landUse: body.landUse != null ? (body.landUse as any) : null,
    zoning: body.zoning != null ? String(body.zoning) : null,
    ratesAndTaxesMonthly: body.ratesAndTaxesMonthly != null ? asNumber(body.ratesAndTaxesMonthly) : null,
    leviesMonthly: body.leviesMonthly != null ? asNumber(body.leviesMonthly) : null,
    securityMonthly: body.securityMonthly != null ? asNumber(body.securityMonthly) : null,
    maintenanceMonthly: body.maintenanceMonthly != null ? asNumber(body.maintenanceMonthly) : null,
    expectedAnnualAppreciationPercent:
      body.expectedAnnualAppreciationPercent != null ? asNumber(body.expectedAnnualAppreciationPercent) : null,

    averageDailyRate: body.averageDailyRate != null ? asNumber(body.averageDailyRate) : null,
    occupancyRate: body.occupancyRate != null ? asNumber(body.occupancyRate) : null,
    availableNightsPerMonth: body.availableNightsPerMonth != null ? Number(body.availableNightsPerMonth) : null,
    platformFeePercent: body.platformFeePercent != null ? asNumber(body.platformFeePercent) : null,
    cleaningFeesMonthly: body.cleaningFeesMonthly != null ? asNumber(body.cleaningFeesMonthly) : null,
    managementFeePercent: body.managementFeePercent != null ? asNumber(body.managementFeePercent) : null,
    furnishingValue: body.furnishingValue != null ? asNumber(body.furnishingValue) : null,
    monthlyUtilities: body.monthlyUtilities != null ? asNumber(body.monthlyUtilities) : null,

    rehabBudget: body.rehabBudget != null ? asNumber(body.rehabBudget) : null,
    holdingCostsMonthly: body.holdingCostsMonthly != null ? asNumber(body.holdingCostsMonthly) : null,
    expectedSalePrice: body.expectedSalePrice != null ? asNumber(body.expectedSalePrice) : null,
    targetSaleDate: body.targetSaleDate ? new Date(String(body.targetSaleDate)) : null,
    projectStage: body.projectStage != null ? (body.projectStage as any) : null,

    afterRepairValue: body.afterRepairValue != null ? asNumber(body.afterRepairValue) : null,
    refinanceAmount: body.refinanceAmount != null ? asNumber(body.refinanceAmount) : null,
    brrrrStage: body.brrrrStage != null ? (body.brrrrStage as any) : null
  };
}
