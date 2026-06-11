import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handler as handleStatementsSendEmail } from "../../_lib/handlers/statementsSendEmail.js";

/** POST /api/statements/:id/send-email — explicit route (in addition to catch-all). */
export default function statementsSendEmail(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = req.query.id;
  if (typeof id === "string" && id.trim()) {
    req.query.id = id.trim();
  }
  return handleStatementsSendEmail(req, res);
}
