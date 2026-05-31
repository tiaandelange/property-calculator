import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../../services/subscriptionPlansSupabase";
import { computeSubscriptionLimits, PLAN_LIMIT_UPGRADE_MESSAGE } from "./subscriptionLimits";

describe("computeSubscriptionLimits", () => {
  it("does not gate properties for legacy users without subscription", () => {
    const limits = computeSubscriptionLimits({
      plans: FALLBACK_SUBSCRIPTION_PLANS,
      subscription: null,
      usage: { propertyCount: 10, investmentReportCount: 2, period: { label: "Month", start: new Date(), end: new Date() } },
      freeUsesRemaining: null
    });
    expect(limits.canCreateProperty).toBe(true);
    expect(limits.isLegacyProfile).toBe(true);
  });

  it("blocks new properties at starter limit", () => {
    const limits = computeSubscriptionLimits({
      plans: FALLBACK_SUBSCRIPTION_PLANS,
      subscription: {
        id: "1",
        userId: "u",
        planCode: "starter",
        status: "trialing",
        trialStart: null,
        trialEnd: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        paymentProvider: null,
        paymentSubscriptionId: null
      },
      usage: { propertyCount: 3, investmentReportCount: 0, period: { label: "Trial", start: new Date(), end: new Date() } }
    });
    expect(limits.canCreateProperty).toBe(false);
    expect(limits.propertyLimit).toBe(3);
    expect(limits.upgradeMessage).toBe(PLAN_LIMIT_UPGRADE_MESSAGE);
  });

  it("blocks report generation at investor limit", () => {
    const limits = computeSubscriptionLimits({
      plans: FALLBACK_SUBSCRIPTION_PLANS,
      subscription: {
        id: "1",
        userId: "u",
        planCode: "investor",
        status: "pending_payment",
        trialStart: null,
        trialEnd: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        paymentProvider: null,
        paymentSubscriptionId: null
      },
      usage: { propertyCount: 1, investmentReportCount: 10, period: { label: "Month", start: new Date(), end: new Date() } }
    });
    expect(limits.canGenerateReport).toBe(false);
    expect(limits.reportLimit).toBe(10);
  });

  it("allows unlimited reports on portfolio", () => {
    const limits = computeSubscriptionLimits({
      plans: FALLBACK_SUBSCRIPTION_PLANS,
      subscription: {
        id: "1",
        userId: "u",
        planCode: "portfolio",
        status: "trialing",
        trialStart: null,
        trialEnd: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        paymentProvider: null,
        paymentSubscriptionId: null
      },
      usage: { propertyCount: 5, investmentReportCount: 100, period: { label: "Trial", start: new Date(), end: new Date() } }
    });
    expect(limits.canGenerateReport).toBe(true);
    expect(limits.reportLimit).toBeNull();
  });
});
