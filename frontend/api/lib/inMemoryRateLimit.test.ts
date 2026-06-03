import { describe, expect, it } from "vitest";
import { checkInMemoryRateLimit } from "./inMemoryRateLimit";

describe("inMemoryRateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-${Date.now()}`;
    expect(checkInMemoryRateLimit(key, { max: 2, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkInMemoryRateLimit(key, { max: 2, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("blocks when limit exceeded", () => {
    const key = `test-block-${Date.now()}`;
    const options = { max: 1, windowMs: 60_000 };
    expect(checkInMemoryRateLimit(key, options).allowed).toBe(true);
    const blocked = checkInMemoryRateLimit(key, options);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});
