import { DEEDS_FEE_TABLES, type DeedsFeeYearKey } from "../data/saPropertyCostTables";

export type { DeedsFeeYearKey } from "../data/saPropertyCostTables";

const TRANSFER_DUTY_ASSUMPTION =
  "Transfer duty uses SARS natural-person acquisition brackets effective 1 April 2026 on the higher of purchase price and declared market value (if any).";

export type TransactionType = "TRANSFER_DUTY" | "VAT_TRANSACTION";
export type BuyerType = "INDIVIDUAL" | "COMPANY" | "TRUST";
export type AttorneyFeeMode = "ESTIMATE" | "MANUAL";
export type PropertyUse = "PRIMARY_RESIDENCE" | "INVESTMENT" | "COMMERCIAL" | "VACANT_LAND" | "OTHER";

export type SaTransferBondInput = {
  purchasePrice: number;
  marketValue?: number | null;
  bondAmount: number;
  depositAmount?: number | null;
  transactionType: TransactionType;
  buyerType: BuyerType;
  includeBondRegistration: boolean;
  province?: string | null;
  municipality?: string | null;
  municipalRatesClearanceProvision: number;
  postagesAndPettiesEstimate: number;
  ficaFeeEstimate: number;
  deedsSearchFeeEstimate: number;
  electronicInstructionFeeEstimate: number;
  vatRate: number;
  attorneyFeeMode: AttorneyFeeMode;
  manualTransferAttorneyFee?: number | null;
  manualBondAttorneyFee?: number | null;
  includeDepositInCashRequired: boolean;
  feeYear: DeedsFeeYearKey;
  isFirstTimeBuyer?: boolean;
  sellerVatRegistered?: boolean;
  propertyUse?: PropertyUse;
};

export type SaTransferBondResult = {
  input: {
    purchasePrice: number;
    marketValue: number | null;
    propertyValueUsed: number;
    bondAmount: number;
    depositAmount: number;
    transactionType: TransactionType;
    includeBondRegistration: boolean;
    buyerType: BuyerType;
    attorneyFeeMode: AttorneyFeeMode;
    feeYear: DeedsFeeYearKey;
    includeDepositInCashRequired: boolean;
  };
  transferCosts: {
    transferDuty: number;
    transferAttorneyFee: number;
    transferAttorneyFeeVat: number;
    deedsOfficeTransferFee: number;
    municipalRatesClearanceProvision: number;
    postagesAndPettiesEstimate: number;
    ficaFeeEstimate: number;
    deedsSearchFeeEstimate: number;
    electronicInstructionFeeEstimate: number;
    transferSubtotal: number;
  };
  bondCosts: {
    bondAttorneyFee: number;
    bondAttorneyFeeVat: number;
    deedsOfficeBondFee: number;
    bondAdminFees: number;
    bondSubtotal: number;
  };
  totals: {
    totalTransferCosts: number;
    totalBondRegistrationCosts: number;
    totalTransferAndBondCosts: number;
    depositAmount: number;
    totalCashRequiredExcludingDeposit: number;
    totalCashRequiredIncludingDeposit: number;
    totalAcquisitionCost: number;
  };
  assumptions: string[];
  warnings: string[];
  chartData: {
    costBreakdown: Array<{ label: string; value: number }>;
  };
};

export function roundZar(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** SARS transfer duty — 1 April 2026 brackets (per spec). */
export function calculateTransferDutySA(propertyValue: number, transactionType: TransactionType): number {
  if (transactionType === "VAT_TRANSACTION") return 0;
  const v = Math.max(0, propertyValue);
  if (v <= 1_210_000) return 0;
  if (v <= 1_663_800) return roundZar((v - 1_210_000) * 0.03);
  if (v <= 2_329_300) return roundZar(13_614 + (v - 1_663_800) * 0.06);
  if (v <= 2_994_800) return roundZar(53_544 + (v - 2_329_300) * 0.08);
  if (v <= 13_310_000) return roundZar(106_784 + (v - 2_994_800) * 0.11);
  return roundZar(1_241_456 + (v - 13_310_000) * 0.13);
}

export function propertyValueForDuty(purchasePrice: number, marketValue?: number | null): number {
  const p = Math.max(0, purchasePrice);
  const m = marketValue != null && Number.isFinite(marketValue) ? Math.max(0, marketValue) : null;
  if (m != null && m > p) return m;
  return p;
}

function lookupDeedsFee(
  amount: number,
  kind: "transfer" | "bond",
  feeYear: DeedsFeeYearKey
): { fee: number; exceededConfiguredMax: boolean } {
  const table = DEEDS_FEE_TABLES[feeYear][kind];
  const v = Math.max(0, amount);
  for (const row of table) {
    if (v >= row.min && v <= row.max) return { fee: row.fee, exceededConfiguredMax: false };
  }
  const last = table[table.length - 1]!;
  return { fee: last.fee, exceededConfiguredMax: v > last.max };
}

export function calculateDeedsOfficeTransferFeeSA(propertyValue: number, feeYear: DeedsFeeYearKey): number {
  return lookupDeedsFee(propertyValue, "transfer", feeYear).fee;
}

export function calculateDeedsOfficeBondFeeSA(bondAmount: number, feeYear: DeedsFeeYearKey): number {
  if (!(bondAmount > 0)) return 0;
  return lookupDeedsFee(bondAmount, "bond", feeYear).fee;
}

/**
 * LSSA-style recommended conveyancing fee (professional fee ex VAT), 2026 projected scale
 * (Cape Town Lawyer / industry guideline summary — estimate only).
 */
export function estimateConveyancingProfessionalFee2026Projected(consideration: number): number {
  const v = Math.max(0, consideration);
  if (v <= 100_000) return 6906;
  if (v <= 500_000) {
    const steps = Math.ceil((v - 100_000) / 50_000);
    return Math.round(6906 + steps * 1102);
  }
  if (v <= 1_000_000) {
    const steps = Math.ceil((v - 500_000) / 100_000);
    return Math.round(15_725 + steps * 2132);
  }
  if (v <= 5_000_000) {
    const steps = Math.ceil((v - 1_000_000) / 200_000);
    return Math.round(26_385 + steps * 2132);
  }
  const steps = Math.ceil((v - 5_000_000) / 1_000_000);
  return Math.round(69_025 + steps * 5366);
}

export function estimateTransferAttorneyFeeSA(params: {
  propertyValue: number;
  manualFee: number | null | undefined;
  mode: AttorneyFeeMode;
}): number {
  if (params.mode === "MANUAL") {
    const m = params.manualFee ?? 0;
    return roundZar(Math.max(0, m));
  }
  return roundZar(estimateConveyancingProfessionalFee2026Projected(params.propertyValue));
}

export function estimateBondAttorneyFeeSA(params: {
  bondAmount: number;
  manualFee: number | null | undefined;
  mode: AttorneyFeeMode;
}): number {
  if (!(params.bondAmount > 0)) return 0;
  if (params.mode === "MANUAL") {
    const m = params.manualFee ?? 0;
    return roundZar(Math.max(0, m));
  }
  return roundZar(estimateConveyancingProfessionalFee2026Projected(params.bondAmount));
}

export function calculateSouthAfricanTransferAndBondCosts(raw: SaTransferBondInput): SaTransferBondResult {
  const assumptions: string[] = [
    TRANSFER_DUTY_ASSUMPTION,
    "Deeds Office registration fees use the configured gazette schedule for the selected fee year (estimate).",
    "Estimated conveyancer professional fees follow published 2026 projected LSSA-style guideline scales (exclusive of VAT); firms may differ.",
    "VAT at 15% is applied to estimated conveyancer professional fees only (not to transfer duty or Deeds Office fees in this model).",
    "Postages, petties, FICA, deeds search and electronic instruction figures are illustrative disbursement allowances — confirm with your conveyancer.",
    "First-time buyer status does not change SARS transfer duty in this calculator (no ad‑hoc discounts applied)."
  ];

  const warnings: string[] = [];

  const purchasePrice = raw.purchasePrice;
  const marketValue = raw.marketValue != null && Number.isFinite(raw.marketValue) ? raw.marketValue : null;
  const propertyValueUsed = propertyValueForDuty(purchasePrice, marketValue);
  const bondAmount = Math.max(0, raw.bondAmount);
  const depositAmount = Math.max(0, raw.depositAmount ?? 0);
  const vatRate = Math.max(0, Math.min(100, raw.vatRate)) / 100;

  if (bondAmount > purchasePrice) {
    warnings.push("Bond amount exceeds purchase price. Confirm if this includes costs or refinance amount.");
  }
  if (depositAmount + bondAmount < purchasePrice - 0.01) {
    warnings.push("Deposit plus bond is less than purchase price. Additional cash may be required to fund the purchase.");
  }
  if (raw.transactionType === "VAT_TRANSACTION") {
    warnings.push("VAT transactions are generally not subject to transfer duty. Confirm with your conveyancer.");
    warnings.push("VAT treatment should be confirmed with the seller and conveyancer.");
  }
  if (raw.buyerType === "TRUST" || raw.buyerType === "COMPANY") {
    warnings.push("Additional legal/tax considerations may apply for company or trust purchasers.");
  }

  warnings.push(
    "Transfer duty is calculated on the property value/consideration. If SARS determines a higher fair value, actual duty may differ."
  );
  warnings.push(
    "Attorney fees vary between firms and are usually based on recommended conveyancing tariffs plus VAT and disbursements."
  );
  warnings.push("This calculator is an estimate. Confirm final fees with the appointed conveyancer.");

  const transferDuty = calculateTransferDutySA(propertyValueUsed, raw.transactionType);

  const deedsT = lookupDeedsFee(propertyValueUsed, "transfer", raw.feeYear);
  const deedsOfficeTransferFee = deedsT.fee;
  if (deedsT.exceededConfiguredMax) {
    warnings.push("Amount exceeds current configured Deeds Office transfer bracket range. Update fee table.");
  }

  const transferAttorneyFee = estimateTransferAttorneyFeeSA({
    propertyValue: propertyValueUsed,
    manualFee: raw.manualTransferAttorneyFee,
    mode: raw.attorneyFeeMode
  });
  const transferAttorneyFeeVat = roundZar(transferAttorneyFee * vatRate);

  const municipalRatesClearanceProvision = Math.max(0, raw.municipalRatesClearanceProvision);
  const postagesAndPettiesEstimate = Math.max(0, raw.postagesAndPettiesEstimate);
  const ficaFeeEstimate = Math.max(0, raw.ficaFeeEstimate);
  const deedsSearchFeeEstimate = Math.max(0, raw.deedsSearchFeeEstimate);
  const electronicInstructionFeeEstimate = Math.max(0, raw.electronicInstructionFeeEstimate);

  const transferSubtotal = roundZar(
    transferDuty +
      transferAttorneyFee +
      transferAttorneyFeeVat +
      deedsOfficeTransferFee +
      municipalRatesClearanceProvision +
      postagesAndPettiesEstimate +
      ficaFeeEstimate +
      deedsSearchFeeEstimate +
      electronicInstructionFeeEstimate
  );

  let bondAttorneyFee = 0;
  let bondAttorneyFeeVat = 0;
  let deedsOfficeBondFee = 0;
  const bondAdminFees = 0;

  if (raw.includeBondRegistration && bondAmount > 0) {
    bondAttorneyFee = estimateBondAttorneyFeeSA({
      bondAmount,
      manualFee: raw.manualBondAttorneyFee,
      mode: raw.attorneyFeeMode
    });
    bondAttorneyFeeVat = roundZar(bondAttorneyFee * vatRate);
    const deedsB = lookupDeedsFee(bondAmount, "bond", raw.feeYear);
    deedsOfficeBondFee = deedsB.fee;
    if (deedsB.exceededConfiguredMax) {
      warnings.push("Amount exceeds current configured Deeds Office bond bracket range. Update fee table.");
    }
  }

  const bondSubtotal = roundZar(bondAttorneyFee + bondAttorneyFeeVat + deedsOfficeBondFee + bondAdminFees);

  const totalTransferCosts = transferSubtotal;
  const totalBondRegistrationCosts = raw.includeBondRegistration ? bondSubtotal : 0;
  const totalTransferAndBondCosts = roundZar(totalTransferCosts + totalBondRegistrationCosts);
  const totalCashRequiredExcludingDeposit = totalTransferAndBondCosts;
  const totalCashRequiredIncludingDeposit = roundZar(
    totalTransferAndBondCosts + (raw.includeDepositInCashRequired ? depositAmount : 0)
  );
  const totalAcquisitionCost = roundZar(purchasePrice + totalTransferAndBondCosts);

  const deedsOfficeFeesCombined = roundZar(deedsOfficeTransferFee + deedsOfficeBondFee);
  const adminDisbursements = roundZar(
    postagesAndPettiesEstimate + ficaFeeEstimate + deedsSearchFeeEstimate + electronicInstructionFeeEstimate
  );

  const chartData = {
    costBreakdown: [
      { label: "Transfer duty", value: transferDuty },
      { label: "Transfer attorney fee + VAT", value: roundZar(transferAttorneyFee + transferAttorneyFeeVat) },
      { label: "Bond attorney fee + VAT", value: roundZar(bondAttorneyFee + bondAttorneyFeeVat) },
      { label: "Deeds office fees", value: deedsOfficeFeesCombined },
      { label: "Municipal provision", value: municipalRatesClearanceProvision },
      { label: "Admin/disbursements", value: adminDisbursements }
    ]
  };

  return {
    input: {
      purchasePrice,
      marketValue,
      propertyValueUsed,
      bondAmount,
      depositAmount,
      transactionType: raw.transactionType,
      includeBondRegistration: raw.includeBondRegistration,
      buyerType: raw.buyerType,
      attorneyFeeMode: raw.attorneyFeeMode,
      feeYear: raw.feeYear,
      includeDepositInCashRequired: raw.includeDepositInCashRequired
    },
    transferCosts: {
      transferDuty,
      transferAttorneyFee,
      transferAttorneyFeeVat,
      deedsOfficeTransferFee,
      municipalRatesClearanceProvision,
      postagesAndPettiesEstimate,
      ficaFeeEstimate,
      deedsSearchFeeEstimate,
      electronicInstructionFeeEstimate,
      transferSubtotal
    },
    bondCosts: {
      bondAttorneyFee,
      bondAttorneyFeeVat,
      deedsOfficeBondFee,
      bondAdminFees,
      bondSubtotal
    },
    totals: {
      totalTransferCosts,
      totalBondRegistrationCosts,
      totalTransferAndBondCosts,
      depositAmount,
      totalCashRequiredExcludingDeposit,
      totalCashRequiredIncludingDeposit,
      totalAcquisitionCost
    },
    assumptions,
    warnings,
    chartData
  };
}
