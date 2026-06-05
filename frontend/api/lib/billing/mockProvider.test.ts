import { afterEach, describe, expect, it } from "vitest";
import { mockBillingProvider } from "./mockProvider";

describe("mockBillingProvider", () => {
  const prevFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = prevFrontendUrl;
  });

  it("returns a mock success URL with plan context", async () => {
    process.env.FRONTEND_URL = "https://www.proplytic.co.za";
    const result = await mockBillingProvider.createCheckoutSession({
      userId: "11111111-1111-1111-1111-111111111111",
      email: "test@example.com",
      planCode: "investor",
      billingPeriod: "monthly"
    });

    expect(result.checkoutUrl).toContain("https://www.proplytic.co.za/subscription/success?");
    expect(result.checkoutUrl).toContain("mock=true");
    expect(result.checkoutUrl).toContain("planCode=investor");
    expect(result.checkoutUrl).toContain("billingPeriod=monthly");
    expect(result.reference).toMatch(/^mock_\d+_11111111-1111-1111-1111-111111111111$/);
  });

  it("does not implement webhooks", async () => {
    await expect(mockBillingProvider.verifyWebhook({} as never)).rejects.toThrow(/does not accept webhooks/i);
  });
});
