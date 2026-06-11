import { readAuthSession } from "../lib/authSession";
import { ApiRequestError } from "../lib/queryErrors";
import { readVercelError } from "./vercelResponse";

export type GenerateStatementPdfResponse = {
  message?: string;
  statementId: string;
  hasPdf?: boolean;
  reused?: boolean;
  ephemeral?: boolean;
  downloadUrl?: string;
  expiresIn?: number;
  storageKey?: string;
  storageBucket?: string;
  error?: string;
};

export type GenerateStatementPdfOptions = {
  force?: boolean;
};

export async function generateStatementPdfViaVercel(
  statementId: string,
  opts: GenerateStatementPdfOptions = {}
): Promise<GenerateStatementPdfResponse> {
  const { session, error: sessionErr } = await readAuthSession();
  if (sessionErr) throw new ApiRequestError(sessionErr.message, { status: 401, code: sessionErr.name });
  const token = session?.access_token;
  if (!token) throw new ApiRequestError("Not signed in.", { status: 401 });

  const res = await fetch("/api/statements/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      statementId,
      ...(opts.force ? { force: true } : {})
    })
  });

  if (!res.ok) {
    const msg = await readVercelError(res);
    throw new ApiRequestError(msg, { status: res.status });
  }

  const json = (await res.json().catch(() => ({}))) as GenerateStatementPdfResponse & { error?: string };
  if (!json.downloadUrl) {
    throw new ApiRequestError(json.error ?? "No download URL returned from statement PDF generator.");
  }
  return json;
}
