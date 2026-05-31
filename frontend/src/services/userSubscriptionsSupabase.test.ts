import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "./subscriptionPlansSupabase";
import { buildInitialUserSubscriptionFields } from "./userSubscriptionsSupabase";

describe("buildInitialUserSubscriptionFields", () => {
  it("uses trialing with trial dates for starter", () => {
    const starter = FALLBACK_SUBSCRIPTION_PLANS.find((p) => p.code === "starter")!;
    const fields = buildInitialUserSubscriptionFields(starter);
    expect(fields.status).toBe("trialing");
    expect(fields.trial_start).toBeTruthy();
    expect(fields.trial_end).toBeTruthy();
    expect(fields.plan_code).toBe("starter");
  });

  it("uses pending_payment for paid plan without trial", () => {
    const investor = FALLBACK_SUBSCRIPTION_PLANS.find((p) => p.code === "investor")!;
    const fields = buildInitialUserSubscriptionFields(investor);
    expect(fields.status).toBe("pending_payment");
    expect(fields.trial_start).toBeNull();
    expect(fields.trial_end).toBeNull();
  });

  it("uses trialing when plan has trial_days", () => {
    const portfolio = FALLBACK_SUBSCRIPTION_PLANS.find((p) => p.code === "portfolio")!;
    const fields = buildInitialUserSubscriptionFields(portfolio);
    expect(fields.status).toBe("trialing");
    expect(fields.trial_end).toBeTruthy();
  });
});
