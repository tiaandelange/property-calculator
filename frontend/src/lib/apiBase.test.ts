import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveApiBaseUrl, resolveApiOrigin } from "./apiBase";

describe("apiBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses VITE_API_BASE_URL when set", () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/api/");
    expect(resolveApiBaseUrl()).toBe("https://api.example.com/api");
    expect(resolveApiOrigin()).toBe("https://api.example.com");
  });

  it("defaults to localhost in development when env unset", () => {
    vi.stubEnv("MODE", "development");
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_API_URL", "");
    expect(resolveApiBaseUrl()).toBe("http://localhost:4000/api");
  });

  it("defaults to same-origin /api in production when env unset", () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_API_URL", "");
    expect(resolveApiBaseUrl()).toBe("/api");
    expect(resolveApiOrigin()).toBe("");
  });
});
