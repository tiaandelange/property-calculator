/**
 * Hub once-off totals — uses `@calculatorShared/saTransferBondCosts` (same engine as public calculators).
 */

import { calculateSouthAfricanTransferAndBondCosts } from "@calculatorShared/saTransferBondCosts";

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export { calculateTransferDutySA as calculateTransferDutySouthAfrica } from "@calculatorShared/saTransferBondCosts";

export type HubOnceOffEstimate = {
  bondRegistrationCost: number;
  transferCost: number;
  totalOnceOff: number;
};

export function estimatePurchaseOnceOffCosts(purchasePrice: number, bondAmount: number): HubOnceOffEstimate {
  const r = calculateSouthAfricanTransferAndBondCosts({
    purchasePrice,
    marketValue: null,
    bondAmount,
    depositAmount: 0,
    transactionType: "TRANSFER_DUTY",
    buyerType: "INDIVIDUAL",
    includeBondRegistration: bondAmount > 0,
    province: null,
    municipality: null,
    municipalRatesClearanceProvision: 7500,
    postagesAndPettiesEstimate: 1200,
    ficaFeeEstimate: 850,
    deedsSearchFeeEstimate: 500,
    electronicInstructionFeeEstimate: 650,
    vatRate: 15,
    attorneyFeeMode: "ESTIMATE",
    manualTransferAttorneyFee: null,
    manualBondAttorneyFee: null,
    includeDepositInCashRequired: false,
    feeYear: "2026_2027"
  });

  return {
    transferCost: roundMoney(r.totals.totalTransferCosts),
    bondRegistrationCost: roundMoney(r.totals.totalBondRegistrationCosts),
    totalOnceOff: roundMoney(r.totals.totalTransferAndBondCosts)
  };
}
