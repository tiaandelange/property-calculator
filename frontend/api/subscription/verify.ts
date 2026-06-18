import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handler as subscriptionAction } from "../_lib/handlers/subscriptionAction.js";

/** POST /api/subscription/verify */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  req.query.action = "verify";
  await subscriptionAction(req, res);
}
