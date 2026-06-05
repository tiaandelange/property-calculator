import { describe, expect, it } from "vitest";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../../services/subscriptionPlansSupabase";
import {
  buildSignupBillingRedirect,
  consumeSignupBillingRedirect,
  planRequiresPaymentAfterSignup,
  settingsSubscriptionPath,
  storeSignupBillingRedirect
} from "./signupBillingFlow";

describe("signupBillingFlow", () => {
  const starter = FALLBACK_SUBSCRIPTION_PLANS.find((p) => p.code === "starter")!;
  const investor = FALLBACK_SUBSCRIPTION_PLANS.find((p) => p.code === "investor")!;
  const portfolio = FALLBACK_SUBSCRIPTION_PLANS.find((p) => p.code === "portfolio")!;

  it("does not redirect free starter signup", () => {
    expect(buildSignupBillingRedirect(starter)).toBeNull();
  });

  it("auto-checkouts investor after signup", () => {
    expect(planRequiresPaymentAfterSignup(investor)).toBe(true);
    expect(buildSignupBillingRedirect(investor)).toEqual({
      planCode: "investor",
      autoCheckout: true
    });
  });

  it("redirects trialing portfolio without auto checkout", () => {
    expect(planRequiresPaymentAfterSignup(portfolio)).toBe(false);
    expect(buildSignupBillingRedirect(portfolio)).toEqual({
      planCode: "portfolio",
      autoCheckout: false
    });
  });

  it("stores and consumes billing redirect from sessionStorage", () => {
    sessionStorage.clear();
    storeSignupBillingRedirect({ planCode: "investor", autoCheckout: true });
    expect(consumeSignupBillingRedirect()).toEqual({
      planCode: "investor",
      autoCheckout: true
    });
    expect(sessionStorage.getItem("pg_pending_signup_billing_redirect")).toBeNull();
  });

  it("builds settings subscription paths", () => {
    expect(settingsSubscriptionPath()).toBe("/settings?section=subscription");
    expect(settingsSubscriptionPath({ checkout: true, planCode: "investor" })).toBe(
      "/settings?section=subscription&checkout=1&plan=investor"
    );
  });
});
