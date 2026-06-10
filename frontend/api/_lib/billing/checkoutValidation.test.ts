import { describe, expect, it } from "vitest";
import {
  assertCheckoutAllowedForPlan,
  CheckoutValidationError,
  parseCheckoutRequest
} from "./checkoutValidation";

describe("checkoutValidation", () => {
  it("requires planCode and billingPeriod", () => {
    expect(() => parseCheckoutRequest({ body: {} } as never)).toThrow(CheckoutValidationError);
    expect(() =>
      parseCheckoutRequest({ body: { planCode: "investor" } } as never)
    ).toThrow(/billingPeriod/);
  });

  it("parses valid checkout body", () => {
    const parsed = parseCheckoutRequest({
      body: { planCode: "portfolio", billingPeriod: "annual" }
    } as never);
    expect(parsed).toEqual({ planCode: "portfolio", billingPeriod: "annual" });
  });

  it("rejects starter checkout", () => {
    expect(() =>
      assertCheckoutAllowedForPlan({
        code: "starter",
        name: "Starter",
        monthlyPrice: 0,
        isActive: true
      })
    ).toThrow("Starter is free and does not require checkout.");
  });
});
