import { describe, expect, it } from "vitest";
import {
  resolveSubscriptionSuccessViewState,
  subscriptionSuccessHeadline,
  subscriptionSuccessMessage,
  paystackCheckoutReference
} from "./subscriptionSuccessState";

describe("subscriptionSuccessState", () => {
  const sub = (status: string) =>
    ({
      id: "1",
      userId: "u",
      planCode: "investor",
      status,
      trialStart: null,
      trialEnd: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      paymentProvider: null,
      paymentSubscriptionId: null
    }) as const;

  it("returns loading while subscription query is loading", () => {
    expect(resolveSubscriptionSuccessViewState(null, { loading: true })).toBe("loading");
  });

  it("maps active and trialing to active view", () => {
    expect(resolveSubscriptionSuccessViewState(sub("active"), { loading: false })).toBe("active");
    expect(resolveSubscriptionSuccessViewState(sub("trialing"), { loading: false })).toBe("active");
  });

  it("maps pending_payment to pending view", () => {
    expect(resolveSubscriptionSuccessViewState(sub("pending_payment"), { loading: false })).toBe(
      "pending_payment"
    );
  });

  it("maps cancelled and expired to failed view", () => {
    expect(resolveSubscriptionSuccessViewState(sub("cancelled"), { loading: false })).toBe("failed");
    expect(resolveSubscriptionSuccessViewState(sub("past_due"), { loading: false })).toBe("failed");
  });

  it("uses clear copy for pending and active states", () => {
    expect(subscriptionSuccessHeadline("active", "Investor")).toBe("Subscription active");
    expect(subscriptionSuccessMessage("pending_payment", null)).toContain("being verified");
  });

  it("reads Paystack reference from redirect query params", () => {
    expect(paystackCheckoutReference(new URLSearchParams("reference=pg_ref"))).toBe("pg_ref");
    expect(paystackCheckoutReference(new URLSearchParams("trxref=pg_ref"))).toBe("pg_ref");
    expect(paystackCheckoutReference(new URLSearchParams("mock=true&reference=pg_ref"))).toBe(null);
  });
});
