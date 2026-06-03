import type { ContactFormValues } from "../lib/contactFormClientValidation";

export type SubmitContactFormResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function submitContactForm(values: ContactFormValues): Promise<SubmitContactFormResult> {
  const res = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || undefined,
      subject: values.subject.trim(),
      message: values.message.trim(),
      website: values.website.trim() || undefined,
      source: "contact_page"
    })
  });

  let data: { ok?: boolean; error?: string } = {};
  try {
    data = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    data = {};
  }

  if (res.ok && data.ok) {
    return { ok: true };
  }

  const error =
    typeof data.error === "string" && data.error.trim()
      ? data.error.trim()
      : res.status === 429
        ? "Too many requests. Please wait a few minutes and try again."
        : "Something went wrong. Please try again later.";

  return { ok: false, error, status: res.status };
}
