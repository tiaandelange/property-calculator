import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateSupabaseRequest } from "../lib/supabaseServerAuth.js";
import {
  cancelSubscriptionForUser,
  createCheckoutSession
} from "../lib/stripeSubscriptionServer.js";

type SubscriptionAction = "checkout" | "cancel";

function parseAction(req: VercelRequest): SubscriptionAction | null {
  const raw = String(req.query.action ?? "").trim().toLowerCase();
  if (raw === "checkout" || raw === "cancel") return raw;
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const action = parseAction(req);
  if (!action) {
    res.status(404).json({ error: "Unknown subscription action." });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    if (action === "checkout") {
      const payload = await createCheckoutSession(auth.ctx.uid);
      res.status(200).json(payload);
      return;
    }

    await cancelSubscriptionForUser(auth.ctx.uid);
    res.status(200).json({ message: "Subscription cancelled." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : action === "checkout" ? "Checkout failed." : "Cancel failed.";
    console.error(`[subscription/${action}]`, msg);
    res.status(500).json({ error: msg });
  }
}
