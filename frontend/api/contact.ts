import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clientIpFromRequest, processContactFormSubmission } from "./lib/contactFormServer.js";
import { getContactServerConfig } from "./lib/contactServerEnv.js";
import {
  checkInMemoryRateLimit,
  pruneInMemoryRateLimitBuckets
} from "./lib/inMemoryRateLimit.js";

const CONTACT_RATE_LIMIT = {
  max: 5,
  windowMs: 15 * 60 * 1000
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  pruneInMemoryRateLimitBuckets();

  const ip = clientIpFromRequest(req) ?? "unknown";
  const rate = checkInMemoryRateLimit(`contact:${ip}`, CONTACT_RATE_LIMIT);
  if (!rate.allowed) {
    res
      .setHeader("Retry-After", String(rate.retryAfterSeconds))
      .status(429)
      .json({ error: "Too many requests. Please try again later." });
    return;
  }

  const serverEnv = getContactServerConfig();
  if (!serverEnv.ok) {
    res.status(serverEnv.status).json({ error: serverEnv.publicError });
    return;
  }

  try {
    const result = await processContactFormSubmission(req, serverEnv.config);
    res.status(result.status).json(result.body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Contact form failed.";
    console.error("[contact]", msg);
    res.status(500).json({ error: "Something went wrong. Please try again later." });
  }
}
