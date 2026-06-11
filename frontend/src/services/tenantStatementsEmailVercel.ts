import { readAuthSession } from "../lib/authSession";
import { ApiRequestError } from "../lib/queryErrors";
import { readVercelError } from "./vercelResponse";

export type SendStatementEmailPayload = {
  statementId: string;
  to: string[];
  subject: string;
  message: string;
  copyMe?: boolean;
};

export async function sendStatementEmailViaVercel(
  payload: SendStatementEmailPayload
): Promise<{ message: string; providerEmailId?: string }> {
  const { session, error: sessionErr } = await readAuthSession();
  if (sessionErr) throw new ApiRequestError(sessionErr.message, { status: 401, code: sessionErr.name });
  const token = session?.access_token;
  if (!token) throw new ApiRequestError("Not signed in.", { status: 401 });

  const res = await fetch(`/api/statements/${encodeURIComponent(payload.statementId)}/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      to: payload.to,
      subject: payload.subject,
      message: payload.message,
      copyMe: payload.copyMe ?? true
    })
  });

  if (!res.ok) {
    const msg = await readVercelError(res);
    throw new ApiRequestError(msg, { status: res.status });
  }

  return (await res.json()) as { message: string; providerEmailId?: string };
}
