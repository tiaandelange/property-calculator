import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handler } from "../_lib/handlers/invoicesGenerate.js";

/** POST /api/invoices/generate — explicit route (in addition to catch-all). */
export default function invoicesGenerate(req: VercelRequest, res: VercelResponse): Promise<void> {
  return handler(req, res);
}
