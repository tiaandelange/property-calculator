import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handler } from "../_lib/handlers/statementsGenerate.js";

/** POST /api/statements/generate — explicit route (in addition to catch-all). */
export default function statementsGenerate(req: VercelRequest, res: VercelResponse): Promise<void> {
  return handler(req, res);
}
