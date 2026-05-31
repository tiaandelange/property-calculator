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
  it("uses trial window when trialing", () => {
    const period = getSubscriptionUsagePeriod({
      id: "1",
      userId: "u",
      planCode: "starter",
      status: "trialing",
      trialStart: "2026-06-01T00:00:00.000Z",
      trialEnd: "2026-06-15T00:00:00.000Z",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      paymentProvider: null,
      paymentSubscriptionId: null
    });
    expect(period.label).toBe("Trial period");
    expect(period.start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});
