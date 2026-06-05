import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePaystackWebhookEvent, paystackBillingProvider } from "./paystackProvider";

const maybeSingle = vi.fn();

vi.mock("../supabaseServiceRole", () => ({
  createServiceRoleSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle
        }),
        or: () => ({
          maybeSingle
        })
      })
    })
  })
}));

describe("paystackBillingProvider", () => {
  const prevSecret = process.env.PAYSTACK_SECRET_KEY;
  const prevFrontendUrl = process.env.FRONTEND_URL;
  const prevSupabaseUrl = process.env.SUPABASE_URL;
  const prevServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    maybeSingle.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = prevSecret;
    if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = prevFrontendUrl;
    if (prevSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevSupabaseUrl;
    if (prevServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceRole;
  });

  it("initializes checkout with plan code and metadata", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_x";
    process.env.FRONTEND_URL = "https://www.proplytic.co.za";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_key";

    maybeSingle.mockResolvedValueOnce({
      data: {
        code: "investor",
        name: "Investor",
        paystack_plan_code_monthly: "PLN_investor",
        paystack_plan_code_annual: null
      },
      error: null
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: "https://checkout.paystack.com/abc123",
            access_code: "abc123",
            reference: "pg_ref_123"
          }
        })
    });

    const result = await paystackBillingProvider.createCheckoutSession({
      userId: "11111111-1111-1111-1111-111111111111",
      email: "buyer@example.com",
      planCode: "investor",
      billingPeriod: "monthly"
    });

    expect(result.checkoutUrl).toBe("https://checkout.paystack.com/abc123");
    expect(result.reference).toBe("pg_ref_123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.paystack.co/transaction/initialize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk_test_x"
        })
      })
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.plan).toBe("PLN_investor");
    expect(body.callback_url).toBe("https://www.proplytic.co.za/subscription/success");
    expect(body.metadata).toEqual({
      user_id: "11111111-1111-1111-1111-111111111111",
      plan_code: "investor",
      billing_period: "monthly"
    });
  });

  it("initializes portfolio checkout with portfolio plan code", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_x";
    process.env.FRONTEND_URL = "https://www.proplytic.co.za";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_key";

    maybeSingle.mockResolvedValueOnce({
      data: {
        code: "portfolio",
        name: "Portfolio",
        paystack_plan_code_monthly: "PLN_portfolio",
        paystack_plan_code_annual: null
      },
      error: null
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: "https://checkout.paystack.com/portfolio456",
            access_code: "portfolio456",
            reference: "pg_ref_portfolio"
          }
        })
    });

    const result = await paystackBillingProvider.createCheckoutSession({
      userId: "11111111-1111-1111-1111-111111111111",
      email: "buyer@example.com",
      planCode: "portfolio",
      billingPeriod: "monthly"
    });

    expect(result.checkoutUrl).toBe("https://checkout.paystack.com/portfolio456");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.plan).toBe("PLN_portfolio");
    expect(body.metadata.plan_code).toBe("portfolio");
  });

  it("normalizes charge.success webhook metadata", async () => {
    const event = await normalizePaystackWebhookEvent("charge.success", {
      id: 123,
      reference: "pg_ref_123",
      status: "success",
      metadata: {
        user_id: "11111111-1111-1111-1111-111111111111",
        plan_code: "investor",
        billing_period: "monthly"
      },
      customer: { customer_code: "CUS_test" },
      paid_at: "2026-06-04T10:00:00.000Z"
    });

    expect(event.provider).toBe("paystack");
    expect(event.eventType).toBe("charge.success");
    expect(event.providerEventId).toBe("charge.success:pg_ref_123");
    expect(event.userId).toBe("11111111-1111-1111-1111-111111111111");
    expect(event.planCode).toBe("investor");
    expect(event.customerId).toBe("CUS_test");
    expect(event.status).toBe("active");
  });

  it("maps invoice.payment_failed to past_due", async () => {
    const event = await normalizePaystackWebhookEvent("invoice.payment_failed", {
      invoice_code: "INV_test",
      status: "failed",
      metadata: {
        user_id: "11111111-1111-1111-1111-111111111111",
        plan_code: "investor"
      }
    });

    expect(event.status).toBe("past_due");
    expect(event.providerEventId).toBe("invoice.payment_failed:INV_test");
  });

  it("rejects invalid webhook signatures", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_x";
    const body = JSON.stringify({ event: "charge.success", data: { reference: "abc" } });
    const req = {
      headers: { "x-paystack-signature": "invalid" },
      on(event: string, handler: (chunk?: Buffer) => void) {
        if (event === "data") handler(Buffer.from(body));
        if (event === "end") handler();
      }
    };

    await expect(paystackBillingProvider.verifyWebhook(req as never)).rejects.toThrow(
      /invalid paystack webhook signature/i
    );
  });

  it("accepts valid webhook signatures", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_x";
    const body = JSON.stringify({
      event: "subscription.disable",
      data: {
        subscription_code: "SUB_test",
        status: "cancelled",
        metadata: {
          user_id: "11111111-1111-1111-1111-111111111111",
          plan_code: "investor"
        }
      }
    });
    const signature = crypto.createHmac("sha512", "sk_test_x").update(body).digest("hex");
    const req = {
      headers: { "x-paystack-signature": signature },
      on(event: string, handler: (chunk?: Buffer) => void) {
        if (event === "data") handler(Buffer.from(body));
        if (event === "end") handler();
      }
    };

    const event = await paystackBillingProvider.verifyWebhook(req as never);
    expect(event.eventType).toBe("subscription.disable");
    expect(event.status).toBe("cancelled");
    expect(event.subscriptionId).toBe("SUB_test");
  });
});
