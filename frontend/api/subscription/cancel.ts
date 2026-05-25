import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateSupabaseRequest } from "../lib/supabaseServerAuth";
import { cancelSubscriptionForUser } from "../lib/stripeSubscriptionServer";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    await cancelSubscriptionForUser(auth.ctx.uid);
    res.status(200).json({ message: "Subscription cancelled." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cancel failed.";
    console.error("[subscription/cancel]", msg);
    res.status(500).json({ error: msg });
  }
}
