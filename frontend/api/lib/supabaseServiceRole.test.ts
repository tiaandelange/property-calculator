import { afterEach, describe, expect, it } from "vitest";
import { cronSecretFromRequest, verifyCronSecret } from "./supabaseServiceRole";

describe("supabaseServiceRole cron auth", () => {
  const prev = process.env.CRON_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it("extracts bearer token", () => {
    expect(cronSecretFromRequest("Bearer abc")).toBe("abc");
  });

  it("verifyCronSecret matches env", () => {
    process.env.CRON_SECRET = "secret-cron";
    expect(verifyCronSecret("secret-cron")).toBe(true);
    expect(verifyCronSecret("wrong")).toBe(false);
    expect(verifyCronSecret("")).toBe(false);
  });
});
