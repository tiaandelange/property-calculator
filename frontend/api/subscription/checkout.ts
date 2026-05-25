import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateSupabaseRequest } from "../lib/supabaseServerAuth";
import { createCheckoutSession } from "../lib/stripeSubscriptionServer";

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
    const payload = await createCheckoutSession(auth.ctx.uid);
    res.status(200).json(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Checkout failed.";
    console.error("[subscription/checkout]", msg);
    res.status(500).json({ error: msg });
  }
}
