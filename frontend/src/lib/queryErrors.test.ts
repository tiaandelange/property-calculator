import { describe, expect, it } from "vitest";
import {
  ApiRequestError,
  formatQueryErrorMessage,
  getErrorStatus,
  queryRetry
} from "./queryErrors";

describe("getErrorStatus", () => {
  it("reads ApiRequestError status", () => {
    expect(getErrorStatus(new ApiRequestError("nope", { status: 403 }))).toBe(403);
  });

  it("parses HTTP status from message text", () => {
    expect(getErrorStatus(new Error("Quota exceeded (HTTP 403)"))).toBe(403);
  });

  it("maps not signed in to 401", () => {
    expect(getErrorStatus(new Error("Not signed in."))).toBe(401);
  });
});

describe("queryRetry", () => {
  it("does not retry 401 or 403", () => {
    expect(queryRetry(0, new ApiRequestError("auth", { status: 401 }))).toBe(false);
    expect(queryRetry(0, new ApiRequestError("forbidden", { status: 403 }))).toBe(false);
  });

  it("retries transient errors up to twice", () => {
    const err = new Error("Failed to fetch");
    expect(queryRetry(0, err)).toBe(true);
    expect(queryRetry(1, err)).toBe(true);
    expect(queryRetry(2, err)).toBe(false);
  });
});

describe("formatQueryErrorMessage", () => {
  it("returns permission copy for 403", () => {
    expect(formatQueryErrorMessage(new ApiRequestError("x", { status: 403 }))).toMatch(/permission/i);
  });

  it("returns server copy for 500", () => {
    expect(formatQueryErrorMessage(new ApiRequestError("x", { status: 500 }))).toMatch(/server error/i);
  });
});
