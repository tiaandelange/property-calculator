/**
 * Per-instance in-memory rate limiting for serverless routes.
 *
 * TODO(rate-limit): Replace with Upstash Redis, Vercel KV, or another shared store
 * so limits apply across all function instances and cold starts.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type InMemoryRateLimitOptions = {
  max: number;
  windowMs: number;
};

export type InMemoryRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function checkInMemoryRateLimit(
  key: string,
  options: InMemoryRateLimitOptions
): InMemoryRateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true };
  }

  if (existing.count >= options.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true };
}

/** Best-effort cleanup to avoid unbounded Map growth on warm instances. */
export function pruneInMemoryRateLimitBuckets(now = Date.now()): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}
