import { afterEach, describe, expect, it } from "vitest";
import { BillingConfigError, resolveBillingProviderName, resolveWebhookBillingProvider } from "./provider";

describe("billing provider resolution", () => {
  const prevProvider = process.env.BILLING_PROVIDER;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (prevProvider === undefined) delete process.env.BILLING_PROVIDER;
    else process.env.BILLING_PROVIDER = prevProvider;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevVercelEnv;
  });

  it("defaults to mock outside production", () => {
    delete process.env.BILLING_PROVIDER;
    process.env.NODE_ENV = "development";
    expect(resolveBillingProviderName()).toBe("mock");
  });

  it("respects explicit BILLING_PROVIDER", () => {
    process.env.BILLING_PROVIDER = "paystack";
    expect(resolveBillingProviderName()).toBe("paystack");
  });

  it("resolves paystack webhook provider from signature header", () => {
    const provider = resolveWebhookBillingProvider({
      headers: { "x-paystack-signature": "abc123" }
    } as never);
    expect(provider.name).toBe("paystack");
  });

  it("throws in production when BILLING_PROVIDER is missing", () => {
    delete process.env.BILLING_PROVIDER;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    expect(() => resolveBillingProviderName()).toThrow(BillingConfigError);
  });

  it("rejects explicit mock in production", () => {
    process.env.BILLING_PROVIDER = "mock";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    expect(() => resolveBillingProviderName()).toThrow(/mock is not allowed in production/i);
  });
});
