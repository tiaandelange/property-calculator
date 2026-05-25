import {
  calculateSouthAfricanTransferAndBondCosts,
  calculateTransferDutySA,
  propertyValueForDuty
} from "../../../shared/calculatorShared/saTransferBondCosts";

describe("calculateTransferDutySA", () => {
  test("1: 1_000_000 => 0", () => {
    expect(calculateTransferDutySA(1_000_000, "TRANSFER_DUTY")).toBe(0);
  });

  test("2: 1_210_000 => 0", () => {
    expect(calculateTransferDutySA(1_210_000, "TRANSFER_DUTY")).toBe(0);
  });

  test("3: 1_500_000 => 8700", () => {
    expect(calculateTransferDutySA(1_500_000, "TRANSFER_DUTY")).toBe(8700);
  });

  test("4: 2_000_000 => 33786", () => {
    expect(calculateTransferDutySA(2_000_000, "TRANSFER_DUTY")).toBe(33786);
  });

  test("5: 2_700_000 => 83200", () => {
    expect(calculateTransferDutySA(2_700_000, "TRANSFER_DUTY")).toBe(83200);
  });

  test("6: 5_000_000 => 327356", () => {
    expect(calculateTransferDutySA(5_000_000, "TRANSFER_DUTY")).toBe(327356);
  });

  test("7: 15_000_000 => 1461156", () => {
    expect(calculateTransferDutySA(15_000_000, "TRANSFER_DUTY")).toBe(1_461_156);
  });

  test("8: VAT_TRANSACTION => 0", () => {
    expect(calculateTransferDutySA(15_000_000, "VAT_TRANSACTION")).toBe(0);
  });
});

describe("propertyValueForDuty", () => {
  test("9: uses higher market value", () => {
    expect(propertyValueForDuty(1_400_000, 1_600_000)).toBe(1_600_000);
  });
});

describe("calculateSouthAfricanTransferAndBondCosts full scenario", () => {
  test("10: purchase 2M, bond 1.8M, transfer duty 33786 and totals consistent", () => {
    const baseInput = {
      purchasePrice: 2_000_000,
      marketValue: null,
      bondAmount: 1_800_000,
      depositAmount: 200_000,
      transactionType: "TRANSFER_DUTY" as const,
      buyerType: "INDIVIDUAL" as const,
      includeBondRegistration: true,
      province: null,
      municipality: null,
      municipalRatesClearanceProvision: 7500,
      postagesAndPettiesEstimate: 1200,
      ficaFeeEstimate: 850,
      deedsSearchFeeEstimate: 500,
      electronicInstructionFeeEstimate: 650,
      vatRate: 15,
      attorneyFeeMode: "ESTIMATE" as const,
      manualTransferAttorneyFee: null,
      manualBondAttorneyFee: null,
      includeDepositInCashRequired: false,
      feeYear: "2026_2027" as const
    };

    const r = calculateSouthAfricanTransferAndBondCosts(baseInput);

    expect(r.transferCosts.transferDuty).toBe(33786);
    expect(r.totals.totalTransferCosts).toBeGreaterThan(33786);
    expect(r.totals.totalBondRegistrationCosts).toBeGreaterThan(0);
    expect(r.totals.totalCashRequiredIncludingDeposit).toBe(r.totals.totalTransferAndBondCosts);

    const withDep = calculateSouthAfricanTransferAndBondCosts({
      ...baseInput,
      includeDepositInCashRequired: true
    });
    expect(withDep.totals.totalCashRequiredIncludingDeposit).toBe(withDep.totals.totalTransferAndBondCosts + 200_000);
  });
});
