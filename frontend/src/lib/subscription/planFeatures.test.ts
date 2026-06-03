import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../../services/subscriptionPlansSupabase";
import {
  canUseFeatureFromSnapshot,
  computePlanPermissions,
  getLimitFromSnapshot,
  hasReachedLimitFromSnapshot
} from "./planFeatures";

describe("computePlanPermissions", () => {
  it("grants admin unlimited features and limits", () => {
    const snapshot = computePlanPermissions({
      plans: FALLBACK_SUBSCRIPTION_PLANS,
      subscription: null,
      usage: {
        propertyCount: 99,
        investmentReportCount: 99,
        period: { label: "Month", start: new Date(), end: new Date() }
      },
      role: "ADMIN"
    });

    expect(snapshot.isAdmin).toBe(true);
    expect(snapshot.features.fullAnalytics).toBe(true);
    expect(snapshot.features.portfolioDashboard).toBe(true);
    expect(snapshot.features.teamAccess).toBe(true);
    expect(getLimitFromSnapshot(snapshot, "maxProperties")).toBeNull();
    expect(hasReachedLimitFromSnapshot(snapshot, "maxProperties", 999)).toBe(false);
    expect(canUseFeatureFromSnapshot(snapshot, "irr")).toBe(true);
  });

  it("starter plan exposes starter limits and basic features only", () => {
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
        propertyCount: 2,
        investmentReportCount: 1,
        period: { label: "Month", start: new Date(), end: new Date() }
      }
    });

    expect(snapshot.isStarter).toBe(true);
    expect(snapshot.features.basicManagement).toBe(true);
    expect(snapshot.features.basicCalculators).toBe(true);
    expect(snapshot.features.fullAnalytics).toBe(false);
    expect(snapshot.features.irr).toBe(false);
    expect(snapshot.features.graphs).toBe(false);
    expect(snapshot.features.forecasting).toBe(false);
    expect(snapshot.features.portfolioDashboard).toBe(false);
    expect(canUseFeatureFromSnapshot(snapshot, "irr")).toBe(false);
    expect(snapshot.limits.maxProperties).toBe(3);
    expect(snapshot.limits.maxReportsPerMonth).toBe(3);
  });

  it("investor unlocks IRR, graphs, and forecasting with 10 reports/month", () => {
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

    expect(snapshot.features.irr).toBe(true);
    expect(snapshot.features.graphs).toBe(true);
    expect(snapshot.features.forecasting).toBe(true);
    expect(snapshot.limits.maxReportsPerMonth).toBe(10);
    expect(snapshot.features.unlimitedReports).toBe(false);
  });

  it("portfolio tier has unlimited reports", () => {
    const snapshot = computePlanPermissions({
      plans: FALLBACK_SUBSCRIPTION_PLANS,
      subscription: {
        id: "3",
        userId: "u",
        planCode: "portfolio",
        status: "active",
        trialStart: null,
        trialEnd: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        paymentProvider: null,
        paymentSubscriptionId: null
      },
      usage: {
        propertyCount: 5,
        investmentReportCount: 50,
        period: { label: "Month", start: new Date(), end: new Date() }
      }
    });

    expect(snapshot.features.unlimitedReports).toBe(true);
    expect(hasReachedLimitFromSnapshot(snapshot, "maxReportsPerMonth", 50)).toBe(false);
  });
});
