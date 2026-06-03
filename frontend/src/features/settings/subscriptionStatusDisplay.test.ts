import { describe, expect, it } from "vitest";
import { formatSubscriptionStatus, formatTrialEndDate } from "./subscriptionStatusDisplay";
import { getSubscriptionUsagePeriod } from "../../services/subscriptionUsageSupabase";

describe("subscriptionStatusDisplay", () => {
  it("formats known statuses", () => {
    expect(formatSubscriptionStatus("pending_payment")).toBe("Pending payment");
    expect(formatSubscriptionStatus("trialing")).toBe("Trialing");
  });

  it("formats trial end date", () => {
    expect(formatTrialEndDate("2026-06-15T12:00:00.000Z")).toMatch(/2026/);
    expect(formatTrialEndDate(null)).toBeNull();
  });
});

describe("getSubscriptionUsagePeriod", () => {
  it("uses current period for free starter plan", () => {
    const period = getSubscriptionUsagePeriod({
      id: "1",
      userId: "u",
      planCode: "starter",
      status: "active",
      trialStart: null,
      trialEnd: null,
      currentPeriodStart: "2026-06-01T00:00:00.000Z",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      paymentProvider: null,
      paymentSubscriptionId: null
    });
    expect(period.label).toBe("Current billing period");
    expect(period.start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});
