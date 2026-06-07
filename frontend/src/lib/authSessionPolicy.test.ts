import type { Session } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  isInvalidRefreshTokenError,
  sessionFromInitialAuthEvent,
  shouldClearSessionForGetSessionError,
  shouldIgnoreSignedOutEvent
} from "./authSessionPolicy";

describe("sessionFromInitialAuthEvent", () => {
  it("keeps cached session when INITIAL_SESSION payload is null", () => {
    const cached = { access_token: "a" } as Session;
    expect(sessionFromInitialAuthEvent(null, cached)).toBe(cached);
  });

  it("returns null when no cached session and payload is null", () => {
    expect(sessionFromInitialAuthEvent(null, null)).toBeNull();
  });

  it("prefers non-null payload", () => {
    const next = { access_token: "b" } as Session;
    expect(sessionFromInitialAuthEvent(next, { access_token: "a" } as Session)).toBe(next);
  });
});

describe("isInvalidRefreshTokenError", () => {
  it("detects invalid refresh token messages", () => {
    expect(isInvalidRefreshTokenError("Invalid Refresh Token: Refresh Token Not Found")).toBe(true);
  });

  it("ignores generic network errors", () => {
    expect(isInvalidRefreshTokenError("Failed to fetch")).toBe(false);
  });
});

describe("shouldClearSessionForGetSessionError", () => {
  it("never clears session from getSession errors", () => {
    expect(
      shouldClearSessionForGetSessionError("Invalid Refresh Token: Refresh Token Not Found", null)
    ).toBe(false);
    const cached = { access_token: "a", user: { id: "u1" } } as Session;
    expect(
      shouldClearSessionForGetSessionError("Invalid Refresh Token: Refresh Token Not Found", cached)
    ).toBe(false);
  });
});

describe("shouldIgnoreSignedOutEvent", () => {
  it("ignores SIGNED_OUT during login", () => {
    const cached = { access_token: "a", user: { id: "u1" } } as Session;
    expect(shouldIgnoreSignedOutEvent(cached, Date.now(), true)).toBe(true);
  });

  it("ignores SIGNED_OUT shortly after session was established", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
    const cached = { access_token: "a", user: { id: "u1" } } as Session;
    const establishedAt = Date.now();
    vi.advanceTimersByTime(2000);
    expect(shouldIgnoreSignedOutEvent(cached, establishedAt, false)).toBe(true);
    vi.useRealTimers();
  });

  it("does not ignore SIGNED_OUT when session is stale", () => {
    const cached = { access_token: "a", user: { id: "u1" } } as Session;
    expect(shouldIgnoreSignedOutEvent(cached, Date.now() - 60_000, false)).toBe(false);
  });
});
