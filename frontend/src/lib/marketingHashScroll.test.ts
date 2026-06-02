import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scheduleMarketingHashScroll, scrollToMarketingHash } from "./marketingHashScroll";

describe("marketingHashScroll", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrollToMarketingHash returns false when target is missing", () => {
    expect(scrollToMarketingHash("#features")).toBe(false);
  });

  it("scrollToMarketingHash scrolls when target exists", () => {
    const el = document.createElement("section");
    el.id = "features";
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    expect(scrollToMarketingHash("#features")).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("scheduleMarketingHashScroll retries until target mounts", () => {
    vi.useFakeTimers();
    const cancel = scheduleMarketingHashScroll("#reports", { intervalMs: 50, maxAttempts: 5 });

    expect(scrollToMarketingHash("#reports")).toBe(false);

    const el = document.createElement("section");
    el.id = "reports";
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    vi.advanceTimersByTime(50);
    expect(el.scrollIntoView).toHaveBeenCalled();

    cancel();
    vi.useRealTimers();
  });
});
