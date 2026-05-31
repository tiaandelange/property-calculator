import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../../services/subscriptionPlansSupabase";
import { resolveSignupPlanSelection } from "./signupPlan";

describe("resolveSignupPlanSelection", () => {
  it("defaults to starter on /signup without plan param", () => {
    const result = resolveSignupPlanSelection("/signup", "", FALLBACK_SUBSCRIPTION_PLANS);
    expect(result.plan.code).toBe("starter");
    expect(result.showSummary).toBe(true);
    expect(result.invalidRequested).toBe(false);
  });

  it("hides summary on /login without plan param", () => {
    const result = resolveSignupPlanSelection("/login", "", FALLBACK_SUBSCRIPTION_PLANS);
    expect(result.showSummary).toBe(false);
  });

  it("resolves investor from query param", () => {
    const result = resolveSignupPlanSelection("/signup", "investor", FALLBACK_SUBSCRIPTION_PLANS);
    expect(result.plan.code).toBe("investor");
    expect(result.invalidRequested).toBe(false);
  });

  it("falls back to starter for invalid plan code", () => {
    const result = resolveSignupPlanSelection("/signup", "enterprise", FALLBACK_SUBSCRIPTION_PLANS);
    expect(result.plan.code).toBe("starter");
    expect(result.invalidRequested).toBe(true);
  });
});
