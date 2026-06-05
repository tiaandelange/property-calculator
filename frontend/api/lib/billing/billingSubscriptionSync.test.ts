import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderWebhookEvent } from "./types";
import {
  processProviderSubscriptionWebhookEvent,
  resolveWebhookUserId,
  WebhookProcessingError
} from "./billingSubscriptionSync";

const webhookSelect = vi.fn();
const webhookUpsert = vi.fn();
const webhookUpdate = vi.fn();
const subscriptionSelect = vi.fn();
const subscriptionUpdateArgs = vi.fn();
const checkoutSelect = vi.fn();

function chainMaybeSingle(result: unknown) {
  return {
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve(result))
      })),
      maybeSingle: vi.fn(() => Promise.resolve(result))
    })),
    order: vi.fn(() => ({
      limit: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve(result))
      }))
    })),
    maybeSingle: vi.fn(() => Promise.resolve(result))
  };
}

vi.mock("../supabaseServiceRole", () => ({
  createServiceRoleSupabase: () => ({
    from: (table: string) => {
      if (table === "webhook_events") {
        return {
          select: vi.fn(() => chainMaybeSingle(webhookSelect())),
          upsert: webhookUpsert,
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => webhookUpdate())
            }))
          }))
        };
      }
      if (table === "user_subscriptions") {
        return {
          select: vi.fn(() => chainMaybeSingle(subscriptionSelect())),
          update: vi.fn((payload: unknown) => {
            subscriptionUpdateArgs(payload);
            return {
              eq: vi.fn(() => ({ error: null }))
            };
          })
        };
      }
      if (table === "checkout_attempts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve(checkoutSelect()))
                  }))
                }))
              }))
            }))
          }))
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }
  })
}));

describe("billingSubscriptionSync webhooks", () => {
  beforeEach(() => {
    webhookSelect.mockReset();
    webhookUpsert.mockReset();
    webhookUpdate.mockReset();
    subscriptionSelect.mockReset();
    subscriptionUpdateArgs.mockReset();
    checkoutSelect.mockReset();

    webhookUpsert.mockResolvedValue({ error: null });
    webhookUpdate.mockResolvedValue({ error: null });
  });

  const baseEvent: ProviderWebhookEvent = {
    provider: "paystack",
    providerEventId: "charge.success:pg_ref_123",
    eventType: "charge.success",
    payload: {
      event: "charge.success",
      data: {
        reference: "pg_ref_123",
        status: "success",
        metadata: {
          user_id: "11111111-1111-1111-1111-111111111111",
          plan_code: "investor"
        },
        customer: { customer_code: "CUS_test" },
        subscription: { subscription_code: "SUB_test" }
      }
    },
    userId: "11111111-1111-1111-1111-111111111111",
    planCode: "investor",
    customerId: "CUS_test",
    subscriptionId: "SUB_test",
    status: "active"
  };

  it("returns already_processed for duplicate provider_event_id", async () => {
    webhookSelect.mockReturnValue({ data: { id: "1", processed_at: "2026-01-01T00:00:00Z" }, error: null });

    const outcome = await processProviderSubscriptionWebhookEvent(baseEvent);
    expect(outcome).toEqual({ status: "already_processed" });
    expect(webhookUpsert).not.toHaveBeenCalled();
  });

  it("activates user_subscriptions on charge.success with payment fields", async () => {
    webhookSelect.mockReturnValue({ data: null, error: null });

    const outcome = await processProviderSubscriptionWebhookEvent({
      ...baseEvent,
      currentPeriodStart: "2026-06-04T10:00:00.000Z",
      currentPeriodEnd: "2026-07-04T10:00:00.000Z"
    });
    expect(outcome).toEqual({ status: "processed" });
    expect(webhookUpsert).toHaveBeenCalled();
    expect(subscriptionUpdateArgs).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_code: "investor",
        status: "active",
        payment_provider: "paystack",
        payment_customer_id: "CUS_test",
        payment_subscription_id: "SUB_test",
        current_period_start: "2026-06-04T10:00:00.000Z",
        current_period_end: "2026-07-04T10:00:00.000Z"
      })
    );
  });

  it("marks past_due on invoice.payment_failed", async () => {
    webhookSelect.mockReturnValue({ data: null, error: null });

    const outcome = await processProviderSubscriptionWebhookEvent({
      ...baseEvent,
      providerEventId: "invoice.payment_failed:INV_test",
      eventType: "invoice.payment_failed",
      status: "past_due"
    });

    expect(outcome).toEqual({ status: "processed" });
    expect(subscriptionUpdateArgs).toHaveBeenCalledWith(
      expect.objectContaining({ status: "past_due" })
    );
  });

  it("marks cancelled on subscription.disable", async () => {
    webhookSelect.mockReturnValue({ data: null, error: null });

    const outcome = await processProviderSubscriptionWebhookEvent({
      ...baseEvent,
      providerEventId: "subscription.disable:SUB_test",
      eventType: "subscription.disable",
      status: "cancelled"
    });

    expect(outcome).toEqual({ status: "processed" });
    expect(subscriptionUpdateArgs).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
  });

  it("resolves user id from checkout_attempts reference when metadata missing", async () => {
    checkoutSelect.mockReturnValue({
      data: { user_id: "22222222-2222-2222-2222-222222222222" },
      error: null
    });

    const userId = await resolveWebhookUserId({
      ...baseEvent,
      userId: undefined,
      payload: {
        event: "charge.success",
        data: { reference: "pg_ref_123" }
      }
    });

    expect(userId).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("throws when user cannot be resolved", async () => {
    webhookSelect.mockReturnValue({ data: null, error: null });
    subscriptionSelect.mockReturnValue({ data: null, error: null });
    checkoutSelect.mockReturnValue({ data: null, error: null });

    await expect(
      processProviderSubscriptionWebhookEvent({
        ...baseEvent,
        userId: undefined,
        customerId: undefined,
        subscriptionId: undefined,
        payload: { event: "charge.success", data: { reference: "missing_ref" } }
      })
    ).rejects.toBeInstanceOf(WebhookProcessingError);
  });
});
