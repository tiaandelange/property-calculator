import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateSupabaseRequest } from "../_lib/supabaseServerAuth.js";
import { getStorageUsageForUser } from "../_lib/handlers/storageUsage.js";

/** GET /api/storage/usage */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).setHeader("Allow", "GET").json({ error: "Method not allowed" });
    return;
  }

  const auth = await authenticateSupabaseRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const usage = await getStorageUsageForUser(auth.ctx.uid);
    res.status(200).json(usage);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not load storage usage.";
    console.error("[storage/usage]", msg);
    res.status(500).json({ error: msg });
  }
}
