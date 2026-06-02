import type { Session } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isInvalidRefreshTokenError, sessionFromInitialAuthEvent } from "./authSessionPolicy";

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
