import { describe, expect, it, vi } from "vitest";
import {
  authBootstrapTimeoutError,
  isAuthBackendUnavailableError,
  withTimeout
} from "./authBackendAvailability";

describe("isAuthBackendUnavailableError", () => {
  it("detects Failed to fetch / DNS-style errors", () => {
    expect(isAuthBackendUnavailableError(new Error("Failed to fetch"))).toBe(true);
    expect(isAuthBackendUnavailableError("AuthRetryableFetchError: Failed to fetch")).toBe(true);
    expect(isAuthBackendUnavailableError(new Error("net::ERR_NAME_NOT_RESOLVED"))).toBe(true);
  });

  it("does not treat credential errors as backend unavailable", () => {
    expect(isAuthBackendUnavailableError(new Error("Invalid login credentials"))).toBe(false);
    expect(isAuthBackendUnavailableError(new Error("Invalid refresh token"))).toBe(false);
  });
});

describe("withTimeout", () => {
  it("resolves when the promise wins", async () => {
    await expect(withTimeout(Promise.resolve(42), 50, () => new Error("slow"))).resolves.toBe(42);
  });

  it("rejects with the timeout error when slow", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(
      new Promise<number>(() => {
        /* never resolves */
      }),
      100,
      () => authBootstrapTimeoutError()
    );
    const expectation = expect(pending).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(100);
    await expectation;
    vi.useRealTimers();
  });
});
