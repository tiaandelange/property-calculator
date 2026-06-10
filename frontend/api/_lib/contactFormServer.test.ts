import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest } from "@vercel/node";
import {
  parseAndValidateContactRequest,
  processContactFormSubmission
} from "./contactFormServer.js";

const insertMock = vi.fn();
const sendEmailMock = vi.fn();
const createSbMock = vi.fn();

vi.mock("./supabaseServiceRole.js", () => ({
  createServiceRoleSupabase: () => createSbMock()
}));

vi.mock("./contactEmail.js", () => ({
  sendContactNotificationEmail: (...args: unknown[]) => sendEmailMock(...args)
}));

function mockRequest(body: unknown, headers: Record<string, string> = {}): VercelRequest {
  return { body, headers } as VercelRequest;
}

const serverConfig = {
  fromEmail: "Proplytic <contact@proplytic.co.za>",
  toEmail: "delangetiaanoffice@gmail.com"
};

describe("parseAndValidateContactRequest", () => {
  it("rejects missing name", () => {
    const result = parseAndValidateContactRequest({
      email: "jane@example.com",
      subject: "Hi",
      message: "Hello"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/name/i);
  });

  it("rejects invalid email", () => {
    const result = parseAndValidateContactRequest({
      name: "Jane",
      email: "not-valid",
      subject: "Hi",
      message: "Hello"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/email/i);
  });

  it("treats honeypot website as silent success path", () => {
    const result = parseAndValidateContactRequest({
      name: "Bot",
      email: "bot@spam.test",
      subject: "Spam",
      message: "Buy now",
      website: "https://spam.test"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.honeypot).toBe(true);
  });
});

describe("processContactFormSubmission", () => {
  beforeEach(() => {
    insertMock.mockReset();
    sendEmailMock.mockReset();
    createSbMock.mockReset();
    createSbMock.mockReturnValue({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: insertMock
          })
        })
      })
    });
  });

  it("returns 200 for honeypot without insert or email", async () => {
    const result = await processContactFormSubmission(
      mockRequest({
        name: "Bot",
        email: "bot@spam.test",
        subject: "Spam",
        message: "Nope",
        website: "filled"
      }),
      serverConfig
    );
    expect(result.status).toBe(200);
    expect(insertMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("inserts row then sends email on valid submission", async () => {
    insertMock.mockResolvedValue({
      data: { id: "sub-uuid-1", created_at: "2026-06-03T10:00:00.000Z" },
      error: null
    });
    sendEmailMock.mockResolvedValue({ ok: true, providerEmailId: "re_123" });

    const body = {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+27 82 000 0000",
      subject: "Pricing",
      message: "Tell me about Investor."
    };

    const result = await processContactFormSubmission(
      mockRequest(body, { "x-forwarded-for": "203.0.113.1", "user-agent": "TestAgent/1.0" }),
      serverConfig
    );

    expect(result.status).toBe(200);
    if (result.status === 200) expect(result.body).toEqual({ ok: true, id: "sub-uuid-1" });

    expect(insertMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+27 82 000 0000",
        subject: "Pricing",
        message: "Tell me about Investor."
      }),
      serverConfig
    );
  });

  it("keeps row but returns 502 when Resend fails", async () => {
    insertMock.mockResolvedValue({
      data: { id: "sub-uuid-2", created_at: "2026-06-03T10:00:00.000Z" },
      error: null
    });
    sendEmailMock.mockResolvedValue({ ok: false, message: "Resend down" });

    const result = await processContactFormSubmission(
      mockRequest({
        name: "Jane",
        email: "jane@example.com",
        subject: "Hi",
        message: "Hello"
      }),
      serverConfig
    );

    expect(result.status).toBe(502);
    if (result.status === 502) {
      expect(result.body.id).toBe("sub-uuid-2");
      expect(result.body.error).toMatch(/notification email/i);
    }
  });
});
