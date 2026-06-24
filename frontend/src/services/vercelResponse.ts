export async function readVercelError(res: Response): Promise<string> {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const isJson = contentType.includes("application/json") || contentType.includes("+json");

  if (isJson) {
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (json?.error) return String(json.error);
    if (json?.message) return String(json.message);
    return `Request failed (${res.status}).`;
  }

  const text = await res.text().catch(() => "");
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (/NOT_FOUND/i.test(cleaned) && cleaned.toLowerCase().includes("page could not be found")) {
    return "Server route not found. If this persists after a deploy, contact support.";
  }
  if (cleaned) return cleaned.slice(0, 280);
  return `Request failed (${res.status}).`;
}

