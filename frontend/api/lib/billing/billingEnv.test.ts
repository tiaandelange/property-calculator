import { afterEach, describe, expect, it } from "vitest";
import {
  assertBillingCheckoutConfig,
  BillingConfigError,
  requireFrontendUrl,
  resolveBillingProviderName
} from "./billingEnv";

describe("billingEnv", () => {
  const prevProvider = process.env.BILLING_PROVIDER;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevVercelEnv = process.env.VERCEL_ENV;
  const prevFrontendUrl = process.env.FRONTEND_URL;
  const prevPaystackKey = process.env.PAYSTACK_SECRET_KEY;

  afterEach(() => {
    if (prevProvider === undefined) delete process.env.BILLING_PROVIDER;
    else process.env.BILLING_PROVIDER = prevProvider;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevVercelEnv;
    if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = prevFrontendUrl;
    if (prevPaystackKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = prevPaystackKey;
  });

  it("defaults to mock outside production", () => {
    delete process.env.BILLING_PROVIDER;
    process.env.NODE_ENV = "development";
    expect(resolveBillingProviderName()).toBe("mock");
  });

  it("rejects mock provider in production", () => {
    process.env.BILLING_PROVIDER = "mock";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    expect(() => resolveBillingProviderName()).toThrow(BillingConfigError);
    expect(() => resolveBillingProviderName()).toThrow(/mock is not allowed in production/i);
  });

  it("throws in production when BILLING_PROVIDER is missing", () => {
    delete process.env.BILLING_PROVIDER;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    expect(() => resolveBillingProviderName()).toThrow(BillingConfigError);
  });

  it("requires FRONTEND_URL for checkout config", () => {
    process.env.BILLING_PROVIDER = "mock";
    process.env.NODE_ENV = "development";
    delete process.env.FRONTEND_URL;
    expect(() => assertBillingCheckoutConfig()).toThrow(/FRONTEND_URL/i);
  });

  it("requires PAYSTACK_SECRET_KEY when provider is paystack", () => {
    process.env.BILLING_PROVIDER = "paystack";
    process.env.FRONTEND_URL = "https://www.proplytic.co.za";
    delete process.env.PAYSTACK_SECRET_KEY;
    expect(() => assertBillingCheckoutConfig()).toThrow(/PAYSTACK_SECRET_KEY/i);
  });

  it("passes checkout config for paystack when env is complete", () => {
    process.env.BILLING_PROVIDER = "paystack";
    process.env.FRONTEND_URL = "https://www.proplytic.co.za";
    process.env.PAYSTACK_SECRET_KEY = "sk_test_example";
    expect(assertBillingCheckoutConfig()).toBe("paystack");
  });

  it("strips trailing slashes from FRONTEND_URL", () => {
    process.env.FRONTEND_URL = "http://localhost:5173/";
    expect(requireFrontendUrl()).toBe("http://localhost:5173");
  });
});
