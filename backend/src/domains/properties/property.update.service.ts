import type { Prisma } from "@prisma/client";
import { asNumber } from "./property.dto.helpers.js";
import { isAllowedBondTermYears } from "./property.bond.helpers.js";

/** Metadata-only patch — never creates ledger rows or tenants from this payload. */
export function buildPropertyUpdateData(body: Record<string, unknown>): Prisma.PropertyUpdateInput {
  return {
    name: body.name !== undefined ? String(body.name) : undefined,
    propertyType: body.propertyType !== undefined ? (body.propertyType as any) : undefined,
    investmentType: body.investmentType !== undefined ? (body.investmentType as any) : undefined,
    addressLine1: body.addressLine1 !== undefined ? String(body.addressLine1) : undefined,
    addressLine2: body.addressLine2 !== undefined ? (body.addressLine2 != null ? String(body.addressLine2) : null) : undefined,
    suburb: body.suburb !== undefined ? (body.suburb != null ? String(body.suburb) : null) : undefined,
    city: body.city !== undefined ? String(body.city) : undefined,
    province: body.province !== undefined ? String(body.province) : undefined,
    postalCode: body.postalCode !== undefined ? (body.postalCode != null ? String(body.postalCode) : null) : undefined,
    country: body.country !== undefined ? String(body.country ?? "South Africa") : undefined,
    erfNumber: body.erfNumber !== undefined ? (body.erfNumber != null ? String(body.erfNumber) : null) : undefined,
    sizeSqm: body.sizeSqm !== undefined ? (body.sizeSqm != null ? asNumber(body.sizeSqm) : null) : undefined,
    bedrooms: body.bedrooms !== undefined ? (body.bedrooms != null ? Number(body.bedrooms) : null) : undefined,
    bathrooms: body.bathrooms !== undefined ? (body.bathrooms != null ? Number(body.bathrooms) : null) : undefined,
    parkingBays: body.parkingBays !== undefined ? (body.parkingBays != null ? Number(body.parkingBays) : null) : undefined,
    purchasePrice: body.purchasePrice !== undefined ? asNumber(body.purchasePrice) : undefined,
    purchaseDate: body.purchaseDate !== undefined ? (body.purchaseDate ? new Date(String(body.purchaseDate)) : null) : undefined,
    currentEstimatedValue: body.currentEstimatedValue !== undefined ? (body.currentEstimatedValue != null ? asNumber(body.currentEstimatedValue) : null) : undefined,
    outstandingBondBalance:
      body.outstandingBondBalance !== undefined
        ? body.outstandingBondBalance != null
          ? asNumber(body.outstandingBondBalance)
          : null
        : undefined,
    monthlyBondPayment: body.monthlyBondPayment !== undefined ? (body.monthlyBondPayment != null ? asNumber(body.monthlyBondPayment) : null) : undefined,
    bondAnnualInterestRatePercent:
      body.bondAnnualInterestRatePercent !== undefined
        ? body.bondAnnualInterestRatePercent != null
          ? asNumber(body.bondAnnualInterestRatePercent)
          : null
        : undefined,
    bondTermYears:
      body.bondTermYears !== undefined
        ? body.bondTermYears != null && isAllowedBondTermYears(body.bondTermYears)
          ? Number(body.bondTermYears)
          : null
        : undefined,
    bondStartDate:
      body.bondStartDate !== undefined
        ? body.bondStartDate != null && String(body.bondStartDate).trim() !== ""
          ? new Date(String(body.bondStartDate))
          : null
        : undefined,
    bondRemainingTermMonths:
      body.bondRemainingTermMonths !== undefined
        ? body.bondRemainingTermMonths != null
          ? Number(body.bondRemainingTermMonths)
          : null
        : undefined,
    bondInterestPortionOverride:
      body.bondInterestPortionOverride !== undefined
        ? body.bondInterestPortionOverride != null
          ? asNumber(body.bondInterestPortionOverride)
          : null
        : undefined,
    bondPrincipalPortionOverride:
      body.bondPrincipalPortionOverride !== undefined
        ? body.bondPrincipalPortionOverride != null
          ? asNumber(body.bondPrincipalPortionOverride)
          : null
        : undefined,
    totalCashInvested: body.totalCashInvested !== undefined ? (body.totalCashInvested != null ? asNumber(body.totalCashInvested) : null) : undefined,
    bondCosts: body.bondCosts !== undefined ? (body.bondCosts != null ? asNumber(body.bondCosts) : null) : undefined,
    transferCosts: body.transferCosts !== undefined ? (body.transferCosts != null ? asNumber(body.transferCosts) : null) : undefined,
    holdingPeriodYears: body.holdingPeriodYears !== undefined ? (body.holdingPeriodYears != null ? Number(body.holdingPeriodYears) : null) : undefined,
    estimatedSellingCostPercent:
      body.estimatedSellingCostPercent !== undefined
        ? body.estimatedSellingCostPercent != null
          ? asNumber(body.estimatedSellingCostPercent)
          : null
        : undefined,
    expectedMonthlyIncome: body.expectedMonthlyIncome !== undefined ? (body.expectedMonthlyIncome != null ? asNumber(body.expectedMonthlyIncome) : null) : undefined,
    expectedMonthlyExpenses:
      body.expectedMonthlyExpenses !== undefined ? (body.expectedMonthlyExpenses != null ? asNumber(body.expectedMonthlyExpenses) : null) : undefined,
    status: body.status !== undefined ? (body.status != null ? String(body.status) : null) : undefined,
    notes: body.notes !== undefined ? (body.notes != null ? String(body.notes) : null) : undefined,

    landUse: body.landUse !== undefined ? (body.landUse as any) : undefined,
    zoning: body.zoning !== undefined ? (body.zoning != null ? String(body.zoning) : null) : undefined,
    ratesAndTaxesMonthly: body.ratesAndTaxesMonthly !== undefined ? (body.ratesAndTaxesMonthly != null ? asNumber(body.ratesAndTaxesMonthly) : null) : undefined,
    leviesMonthly: body.leviesMonthly !== undefined ? (body.leviesMonthly != null ? asNumber(body.leviesMonthly) : null) : undefined,
    securityMonthly: body.securityMonthly !== undefined ? (body.securityMonthly != null ? asNumber(body.securityMonthly) : null) : undefined,
    maintenanceMonthly: body.maintenanceMonthly !== undefined ? (body.maintenanceMonthly != null ? asNumber(body.maintenanceMonthly) : null) : undefined,
    expectedAnnualAppreciationPercent:
      body.expectedAnnualAppreciationPercent !== undefined
        ? body.expectedAnnualAppreciationPercent != null
          ? asNumber(body.expectedAnnualAppreciationPercent)
          : null
        : undefined,

    averageDailyRate: body.averageDailyRate !== undefined ? (body.averageDailyRate != null ? asNumber(body.averageDailyRate) : null) : undefined,
    occupancyRate: body.occupancyRate !== undefined ? (body.occupancyRate != null ? asNumber(body.occupancyRate) : null) : undefined,
    availableNightsPerMonth:
      body.availableNightsPerMonth !== undefined ? (body.availableNightsPerMonth != null ? Number(body.availableNightsPerMonth) : null) : undefined,
    platformFeePercent: body.platformFeePercent !== undefined ? (body.platformFeePercent != null ? asNumber(body.platformFeePercent) : null) : undefined,
    cleaningFeesMonthly: body.cleaningFeesMonthly !== undefined ? (body.cleaningFeesMonthly != null ? asNumber(body.cleaningFeesMonthly) : null) : undefined,
    managementFeePercent: body.managementFeePercent !== undefined ? (body.managementFeePercent != null ? asNumber(body.managementFeePercent) : null) : undefined,
    furnishingValue: body.furnishingValue !== undefined ? (body.furnishingValue != null ? asNumber(body.furnishingValue) : null) : undefined,
    monthlyUtilities: body.monthlyUtilities !== undefined ? (body.monthlyUtilities != null ? asNumber(body.monthlyUtilities) : null) : undefined,

    rehabBudget: body.rehabBudget !== undefined ? (body.rehabBudget != null ? asNumber(body.rehabBudget) : null) : undefined,
    holdingCostsMonthly: body.holdingCostsMonthly !== undefined ? (body.holdingCostsMonthly != null ? asNumber(body.holdingCostsMonthly) : null) : undefined,
    expectedSalePrice: body.expectedSalePrice !== undefined ? (body.expectedSalePrice != null ? asNumber(body.expectedSalePrice) : null) : undefined,
    targetSaleDate: body.targetSaleDate !== undefined ? (body.targetSaleDate ? new Date(String(body.targetSaleDate)) : null) : undefined,
    projectStage: body.projectStage !== undefined ? (body.projectStage as any) : undefined,

    afterRepairValue: body.afterRepairValue !== undefined ? (body.afterRepairValue != null ? asNumber(body.afterRepairValue) : null) : undefined,
    refinanceAmount: body.refinanceAmount !== undefined ? (body.refinanceAmount != null ? asNumber(body.refinanceAmount) : null) : undefined,
    brrrrStage: body.brrrrStage !== undefined ? (body.brrrrStage as any) : undefined
  };
}
