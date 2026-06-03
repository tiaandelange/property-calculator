import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../../services/subscriptionPlansSupabase";
import { computePlanPermissions } from "./planFeatures";
import { canCreateApplicationLinkFromSnapshot } from "./planGatingHelpers";

describe("canCreateApplicationLinkFromSnapshot", () => {
  it("allows starter one link when under cap despite feature flag off", () => {
    const snapshot = computePlanPermissions({
      plans: FALLBACK_SUBSCRIPTION_PLANS,
      subscription: {
        id: "1",
        userId: "u",
        planCode: "starter",
        status: "active",
        trialStart: null,
        trialEnd: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        paymentProvider: null,
        paymentSubscriptionId: null
      },
      usage: {
        propertyCount: 1,
        investmentReportCount: 0,
        period: { label: "Month", start: new Date(), end: new Date() }
      }
    });

    expect(snapshot.features.applicationLinks).toBe(false);
    expect(snapshot.limits.maxApplicationLinks).toBe(1);
    expect(canCreateApplicationLinkFromSnapshot(snapshot)).toBe(true);
  });

  it("blocks investor at application link cap", () => {
    const snapshot = computePlanPermissions({
      plans: FALLBACK_SUBSCRIPTION_PLANS,
      subscription: {
        id: "2",
        userId: "u",
        planCode: "investor",
        status: "active",
        trialStart: null,
        trialEnd: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        paymentProvider: null,
        paymentSubscriptionId: null
      },
      usage: {
        propertyCount: 1,
        investmentReportCount: 0,
        period: { label: "Month", start: new Date(), end: new Date() }
      }
    });
    snapshot.usage.applicationLinksActive = 10;

    expect(canCreateApplicationLinkFromSnapshot(snapshot)).toBe(false);
  });
});
