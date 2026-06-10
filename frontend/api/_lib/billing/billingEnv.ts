import type { BillingProviderName } from "./types.js";

export class BillingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingConfigError";
  }
}

/** True for local dev, Vitest, and Vercel preview — not production billing. */
export function isNonProductionBillingRuntime(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const vercelEnv = (process.env.VERCEL_ENV || "").trim();
  return vercelEnv === "development" || vercelEnv === "preview";
}

export function resolveBillingProviderName(): BillingProviderName {
  const raw = (process.env.BILLING_PROVIDER || "").trim().toLowerCase();

  if (raw === "mock") {
    if (!isNonProductionBillingRuntime()) {
      throw new BillingConfigError(
        "BILLING_PROVIDER=mock is not allowed in production. Set BILLING_PROVIDER=paystack (or payfast) for paid checkout."
      );
    }
    return "mock";
  }

  if (raw === "paystack" || raw === "payfast") {
    return raw;
  }

  if (!raw) {
    if (isNonProductionBillingRuntime()) return "mock";
    throw new BillingConfigError(
      "BILLING_PROVIDER is required in production. Set BILLING_PROVIDER=paystack (or payfast)."
    );
  }

  throw new BillingConfigError(`Unknown BILLING_PROVIDER: ${raw}`);
}

/** Explicit public site origin for checkout redirects — no Vercel/localhost fallback. */
export function requireFrontendUrl(): string {
  const url = (process.env.FRONTEND_URL || "").trim();
  if (!url) {
    throw new BillingConfigError(
      "FRONTEND_URL is not configured. Set it to your public site origin (e.g. https://www.proplytic.co.za or http://localhost:5173)."
    );
  }
  return url.replace(/\/+$/, "");
}

function requirePaystackSecretKey(): void {
  const key = (process.env.PAYSTACK_SECRET_KEY || "").trim();
  if (!key) {
    throw new BillingConfigError(
      "PAYSTACK_SECRET_KEY is not configured. Set it in Vercel server environment variables (never under a VITE_ prefix)."
    );
  }
}

/**
 * Fail closed before starting paid checkout.
 * Call from POST /api/subscription/checkout after auth and plan validation.
 */
export function assertBillingCheckoutConfig(): BillingProviderName {
  const provider = resolveBillingProviderName();

  requireFrontendUrl();

  if (provider === "paystack") {
    requirePaystackSecretKey();
  }

  return provider;
}
