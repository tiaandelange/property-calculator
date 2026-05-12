import { describe, expect, it } from "vitest";
import { calculateTransferDutySouthAfrica, estimatePurchaseOnceOffCosts } from "./saOnceOffEstimates";

describe("calculateTransferDutySouthAfrica", () => {
  it("is zero at the first bracket top", () => {
    expect(calculateTransferDutySouthAfrica(1_000_000, "TRANSFER_DUTY")).toBe(0);
  });

  it("returns a positive duty above exempt threshold", () => {
    expect(calculateTransferDutySouthAfrica(2_300_000, "TRANSFER_DUTY")).toBeGreaterThan(0);
  });
});

describe("estimatePurchaseOnceOffCosts", () => {
  it("splits bond registration vs transfer and sums", () => {
    const o = estimatePurchaseOnceOffCosts(2_000_000, 1_800_000);
    expect(o.bondRegistrationCost).toBeGreaterThan(0);
    expect(o.transferCost).toBeGreaterThan(0);
    expect(o.totalOnceOff).toBeCloseTo(o.bondRegistrationCost + o.transferCost, 0);
  });

  it("bond registration is zero when bond amount is zero", () => {
    const o = estimatePurchaseOnceOffCosts(1_500_000, 0);
    expect(o.bondRegistrationCost).toBe(0);
    expect(o.totalOnceOff).toBe(o.transferCost);
  });
});
