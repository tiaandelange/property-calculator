import request from "supertest";

const dbMock = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn()
  }
};

jest.mock("../../src/config/db", () => ({ db: dbMock }));

import { app } from "../../src/app";

describe("Auth hardening — validation, error handler, headers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("helmet sets nosniff and frame-options on every response", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  test("/auth/register normalises email + name and returns generic 201 regardless of existence", async () => {
    dbMock.user.findUnique.mockResolvedValueOnce(null);
    dbMock.user.create.mockResolvedValueOnce({ id: 1 });

    const created = await request(app).post("/api/auth/register").send({
      email: "  Foo.Bar+tag@Example.COM ",
      password: "Aa1aaaaa",
      name: "  Alice  "
    });

    expect(created.status).toBe(201);
    expect(created.body.message).toMatch(/if this email is available/i);
    expect(dbMock.user.create).toHaveBeenCalledTimes(1);
    const callArg = dbMock.user.create.mock.calls[0][0].data;
    expect(callArg.email).toBe("foo.bar+tag@example.com");
    expect(callArg.name).toBe("Alice");

    // Existing email -> identical generic 201; user.create must NOT be called again.
    dbMock.user.findUnique.mockResolvedValueOnce({ id: 1 });
    const dupe = await request(app).post("/api/auth/register").send({
      email: "foo.bar+tag@example.com",
      password: "Aa1aaaaa"
    });
    expect(dupe.status).toBe(201);
    expect(dupe.body.message).toMatch(/if this email is available/i);
    expect(dbMock.user.create).toHaveBeenCalledTimes(1);
  });

  test("/auth/register rejects weak / malformed payloads with a single generic 400", async () => {
    const cases = [
      { email: "not-an-email", password: "Aa1aaaaa" },
      { email: "ok@example.com", password: "short1" },
      { email: "ok@example.com", password: "alllowercase" },
      { email: "ok@example.com", password: "12345678" },
      { email: "ok@example.com" }
    ];
    for (const body of cases) {
      const res = await request(app).post("/api/auth/register").send(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/could not create account/i);
      expect(res.body.issues).toBeUndefined();
    }
    expect(dbMock.user.create).not.toHaveBeenCalled();
  });

  test("/auth/login returns generic 401 for unknown email and never reveals existence", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app).post("/api/auth/login").send({
      email: "ghost@example.com",
      password: "anyvalue1"
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  test("/auth/login returns generic 401 for malformed body (no zod issue leak)", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "x", password: 12345 });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
    expect(res.body.issues).toBeUndefined();
  });

  test("express.json refuses bodies over 200KB and the error handler maps to a clean 413", async () => {
    const huge = "x".repeat(300 * 1024);
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(`{"email":"a@b.co","password":"${huge}"}`);
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/too large/i);
  });
});
