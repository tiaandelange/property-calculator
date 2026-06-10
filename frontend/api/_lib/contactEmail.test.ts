import { afterEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock }
  }))
}));

describe("contactEmail", () => {
  const prevKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    sendMock.mockReset();
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
  });

  it("sends to delivery inbox with replyTo and full body fields", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockResolvedValue({ data: { id: "email_1" }, error: null });

    const { sendContactNotificationEmail } = await import("./contactEmail.js");

    const result = await sendContactNotificationEmail(
      {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+27 82 111 2222",
        subject: "Reports",
        message: "Need help with PDF export.",
        source: "contact_page",
        createdAt: "2026-06-03T10:00:00.000Z",
        ipAddress: "203.0.113.1",
        userAgent: "Mozilla/5.0"
      },
      {
        fromEmail: "Proplytic <contact@proplytic.co.za>",
        toEmail: "delangetiaanoffice@gmail.com"
      }
    );

    expect(result.ok).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Proplytic <contact@proplytic.co.za>",
        to: ["delangetiaanoffice@gmail.com"],
        replyTo: "jane@example.com",
        subject: "New Proplytic contact form submission: Reports"
      })
    );

    const html = String(sendMock.mock.calls[0]?.[0]?.html ?? "");
    expect(html).toContain("Jane Doe");
    expect(html).toContain("jane@example.com");
    expect(html).toContain("+27 82 111 2222");
    expect(html).toContain("Reports");
    expect(html).toContain("Need help with PDF export.");
  });
});
