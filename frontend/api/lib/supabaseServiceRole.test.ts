import { afterEach, describe, expect, it, vi } from "vitest";
import { createServiceRoleSupabase, cronSecretFromRequest, verifyCronSecret } from "./supabaseServiceRole";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({}))
}));

describe("createServiceRoleSupabase", () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    vi.clearAllMocks();
  });

  it("strips /rest/v1 suffix from SUPABASE_URL", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    process.env.SUPABASE_URL = "https://example.supabase.co/rest/v1/";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    createServiceRoleSupabase();
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      expect.any(Object)
    );
  });
});

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
