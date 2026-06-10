import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canTrackAnalytics, trackEvent } from "./analytics";
import { COOKIE_CONSENT_STORAGE_KEY } from "./consent";

describe("analytics", () => {
  beforeEach(() => {
    localStorage.clear();
    (window as Window & { dataLayer?: unknown[] }).dataLayer = [];
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("canTrackAnalytics is false without consent", () => {
    expect(canTrackAnalytics()).toBe(false);
  });

  it("canTrackAnalytics is true when consent accepted and dataLayer exists", () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "accepted");
    expect(canTrackAnalytics()).toBe(true);
  });

  it("trackEvent strips forbidden keys and null values", () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "accepted");
    const dataLayer: unknown[] = [];
    (window as Window & { dataLayer?: unknown[] }).dataLayer = dataLayer;

    trackEvent("select_plan", {
      plan_code: "investor",
      billing_period: "monthly",
      email: "secret@example.com",
      source_page: "/pricing",
      amount: 99
    } as Record<string, string | number>);

    expect(dataLayer).toHaveLength(1);
    const payload = dataLayer[0] as Record<string, unknown>;
    expect(payload.event).toBe("select_plan");
    expect(payload.plan_code).toBe("investor");
    expect(payload.billing_period).toBe("monthly");
    expect(payload.source_page).toBe("/pricing");
    expect(payload.email).toBeUndefined();
    expect(payload.amount).toBeUndefined();
  });

  it("trackEvent does not throw when dataLayer is missing", () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "accepted");
    delete (window as Window & { dataLayer?: unknown[] }).dataLayer;
    expect(() => trackEvent("view_pricing")).not.toThrow();
  });
});
