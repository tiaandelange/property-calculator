import { afterEach, describe, expect, it } from "vitest";
import {
  CONTACT_DELIVERY_EMAIL_DEFAULT,
  CONTACT_PUBLIC_CONFIG_ERROR,
  contactFromEmailFromEnv,
  getContactServerConfig,
  missingContactServerEnvVars
} from "./contactServerEnv";

const ENV_KEYS = [
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "CONTACT_FROM_EMAIL",
  "INVOICE_EMAIL_FROM",
  "CONTACT_TO_EMAIL"
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    out[key] = process.env[key];
  }
  return out;
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function setValidContactEnv(): void {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  delete process.env.VITE_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.CONTACT_FROM_EMAIL = "Proplytic <contact@proplytic.co.za>";
  delete process.env.CONTACT_TO_EMAIL;
}

describe("contactServerEnv", () => {
  const prev = snapshotEnv();

  afterEach(() => {
    restoreEnv(prev);
  });

  it("reports all required vars when unset", () => {
    for (const key of ENV_KEYS) delete process.env[key];
    expect(missingContactServerEnvVars().sort()).toEqual(
      ["RESEND_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"].sort()
    );
  });

  it("accepts VITE_SUPABASE_URL as project URL", () => {
    setValidContactEnv();
    delete process.env.SUPABASE_URL;
    process.env.VITE_SUPABASE_URL = "https://vite-alias.supabase.co";
    expect(getContactServerConfig().ok).toBe(true);
  });

  it("falls back to INVOICE_EMAIL_FROM when CONTACT_FROM_EMAIL is unset", () => {
    setValidContactEnv();
    delete process.env.CONTACT_FROM_EMAIL;
    process.env.INVOICE_EMAIL_FROM = "Proplytic <hello@proplytic.co.za>";
    expect(contactFromEmailFromEnv()).toBe("Proplytic <hello@proplytic.co.za>");
    const result = getContactServerConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.fromEmail).toBe("Proplytic <hello@proplytic.co.za>");
    }
  });

  it("falls back to default sender when neither contact nor invoice from is set", () => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    process.env.RESEND_API_KEY = "re_test_key";
    expect(contactFromEmailFromEnv()).toBe("Proplytic Accounts <invoices@proplytic.co.za>");
    expect(getContactServerConfig().ok).toBe(true);
  });

  it("returns ready config with default delivery address", () => {
    setValidContactEnv();
    const result = getContactServerConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.fromEmail).toBe("Proplytic <contact@proplytic.co.za>");
      expect(result.config.toEmail).toBe(CONTACT_DELIVERY_EMAIL_DEFAULT);
    }
  });
});
