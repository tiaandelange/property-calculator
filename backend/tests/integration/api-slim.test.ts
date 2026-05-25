import request from "supertest";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";

jest.mock("../../src/config/supabaseClient.js", () => ({
  isSupabaseServiceConfigured: true,
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                  role: "USER",
                  subscription_status: "FREE"
                },
                error: null
              })
            })
          }),
          update: () => ({
            eq: async () => ({ error: null })
          })
        };
      }
      return {
        insert: async () => ({ error: null }),
        update: () => ({ eq: async () => ({ error: null }) })
      };
    }
  })
}));

import { app } from "../../src/app.js";

describe("slim API", () => {
  test("GET /api/health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.dataStore).toBe("supabase");
  });

  test("rejects missing bearer on subscription checkout", async () => {
    const res = await request(app).post("/api/subscription/checkout").send({});
    expect(res.status).toBe(401);
  });

  test("accepts Supabase JWT on subscription checkout when Stripe is unset", async () => {
    if (!env.SUPABASE_JWT_SECRET) {
      return;
    }
    const token = jwt.sign(
      { sub: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", aud: "authenticated", email: "u@example.com" },
      env.SUPABASE_JWT_SECRET,
      { algorithm: "HS256" }
    );
    const res = await request(app)
      .post("/api/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe("mock");
  });
});
