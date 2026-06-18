import { describe, expect, it } from "vitest";
import {
  planModalPriceLine,
  resolveChangeModalCurrentPlanCode,
  resolvePendingCheckoutPlanCode
} from "./planModalDisplay";
import type { UserSubscriptionRecord } from "../../services/userSubscriptionsSupabase";

function sub(partial: Partial<UserSubscriptionRecord> & Pick<UserSubscriptionRecord, "planCode" | "status">): UserSubscriptionRecord {
  return {
    id: "1",
    userId: "u1",
    trialStart: null,
    trialEnd: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    paymentProvider: null,
    paymentSubscriptionId: null,
    ...partial
  };
}

describe("planModalDisplay", () => {
  it("defaults to starter when no subscription row", () => {
    expect(resolveChangeModalCurrentPlanCode(null, null)).toBe("starter");
  });

  it("treats pending_payment as Free (starter) for current plan badge", () => {
    expect(
      resolveChangeModalCurrentPlanCode(
        sub({ planCode: "portfolio", status: "pending_payment" }),
        "portfolio"
      )
    ).toBe("starter");
    expect(
      resolvePendingCheckoutPlanCode(sub({ planCode: "portfolio", status: "pending_payment" }))
    ).toBe("portfolio");
  });

  it("uses active plan code when subscribed", () => {
    expect(
      resolveChangeModalCurrentPlanCode(
        sub({ planCode: "investor", status: "active", paymentProvider: "paystack" }),
        "investor"
      )
    ).toBe("investor");
  });

  it("shows clear monthly price without trial headline", () => {
    expect(planModalPriceLine({ monthlyPrice: 599, currency: "ZAR" } as never)).toBe("R599/month");
    expect(planModalPriceLine({ monthlyPrice: 0, currency: "ZAR" } as never)).toBe("R0/month");
  });
});
