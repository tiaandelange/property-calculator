import { describe, expect, it } from "vitest";
import { parseConfirmEmailRedirect } from "./confirmEmailAuth";

describe("parseConfirmEmailRedirect", () => {
  it("detects PKCE code in query", () => {
    expect(parseConfirmEmailRedirect("?code=abc123", "")).toEqual({
      kind: "code",
      code: "abc123"
    });
  });

  it("detects token_hash + type in query", () => {
    expect(parseConfirmEmailRedirect("?token_hash=th&type=signup", "")).toEqual({
      kind: "otp",
      tokenHash: "th",
      type: "signup"
    });
  });

  it("detects token_hash + type in hash", () => {
    expect(parseConfirmEmailRedirect("", "#token_hash=th&type=email")).toEqual({
      kind: "otp",
      tokenHash: "th",
      type: "email"
    });
  });

  it("detects implicit hash tokens", () => {
    expect(parseConfirmEmailRedirect("", "#access_token=at&type=signup")).toEqual({ kind: "implicit" });
  });

  it("detects auth errors", () => {
    expect(parseConfirmEmailRedirect("?error=access_denied&error_description=Expired", "")).toEqual({
      kind: "error",
      message: "Expired"
    });
  });

  it("returns none when empty", () => {
    expect(parseConfirmEmailRedirect("", "")).toEqual({ kind: "none" });
  });
});
