/**
 * Creates (or updates) four dev tier test auth users and assigns subscription plans.
 * Uses SUPABASE_SERVICE_ROLE_KEY from backend/.env only — never run in the browser.
 *
 * Usage (from repo root or backend/):
 *   cd backend && npm run dev:seed-subscription-users
 *
 * Optional env:
 *   DEV_TEST_USER_PASSWORD  — shared password for tier test accounts (default documented in docs)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — required
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../.env") });

const ADMIN_EMAIL = "delangetiaan13@gmail.com";

/** @type {{ email: string; plan: string }[]} */
const TIER_TEST_USERS = [
  { email: "proplytic.starter@test.local", plan: "starter" },
  { email: "proplytic.investor@test.local", plan: "investor" },
  { email: "proplytic.portfolio@test.local", plan: "portfolio" },
  { email: "proplytic.pro@test.local", plan: "portfolio_pro" }
];

const DEFAULT_DEV_PASSWORD =
  process.env.DEV_TEST_USER_PASSWORD?.trim() || "ProplyticDevTest1!";

function requireEnv(name) {
  const v = (process.env[name] || "").trim();
  if (!v) {
    console.error(`[dev:seed-subscription-users] Missing ${name} in backend/.env`);
    process.exit(1);
  }
  return v;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} email
 */
async function findUserIdByEmail(sb, email) {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  while (page <= 20) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => (u.email || "").toLowerCase() === normalized);
    if (match) return match.id;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} email
 */
async function ensureAuthUser(sb, email, password) {
  const existingId = await findUserIdByEmail(sb, email);
  if (existingId) {
    console.log(`  auth user exists: ${email}`);
    return existingId;
  }

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  console.log(`  created auth user: ${email}`);
  return data.user.id;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} email
 * @param {string} plan
 */
async function assignPlan(sb, email, plan) {
  const { data, error } = await sb.rpc("set_user_plan", {
    target_email: email,
    new_plan: plan
  });
  if (error) throw new Error(`set_user_plan(${email}, ${plan}): ${error.message}`);
  console.log(`  plan assigned: ${email} → ${plan}`, data ?? "");
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log("[dev:seed-subscription-users] Tier test users (password from DEV_TEST_USER_PASSWORD or default)");
  console.log(`  default password: ${DEFAULT_DEV_PASSWORD}`);
  console.log("  (change via DEV_TEST_USER_PASSWORD in backend/.env)\n");

  for (const { email, plan } of TIER_TEST_USERS) {
    console.log(`Processing ${email}…`);
    await ensureAuthUser(sb, email, DEFAULT_DEV_PASSWORD);
    await assignPlan(sb, email, plan);
  }

  console.log(`\nProcessing admin ${ADMIN_EMAIL}…`);
  const adminId = await findUserIdByEmail(sb, ADMIN_EMAIL);
  if (!adminId) {
    console.warn(
      `  No auth user for ${ADMIN_EMAIL}. Sign up once in the app, then re-run this script.`
    );
  } else {
    await assignPlan(sb, ADMIN_EMAIL, "portfolio_pro");
    console.log("  admin subscription: portfolio_pro (profiles.role stays ADMIN via set_user_plan)");
  }

  console.log("\nDone. Sign in at /login with each test email to verify tier limits.");
}

main().catch((err) => {
  console.error("[dev:seed-subscription-users] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
