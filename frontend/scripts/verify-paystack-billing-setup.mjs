/**
 * Verify Paystack ↔ Supabase ↔ env wiring before testing Complete Payment.
 *
 * Usage (from frontend/):
 *   # Load Preview/local server env into .env.local first (vercel env pull, or paste manually)
 *   node scripts/verify-paystack-billing-setup.mjs
 *
 * Reads process.env only — never prints full secrets.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const envLocal = join(frontendRoot, ".env.local");

function loadDotEnvLocal() {
  if (!existsSync(envLocal)) return;
  const text = readFileSync(envLocal, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function maskSecret(value) {
  const s = String(value ?? "").trim();
  if (!s) return "(missing)";
  if (s.length <= 8) return "****";
  return `${s.slice(0, 7)}…${s.slice(-4)}`;
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

loadDotEnvLocal();

const billingProvider = (process.env.BILLING_PROVIDER || "").trim().toLowerCase();
const paystackKey = (process.env.PAYSTACK_SECRET_KEY || "").trim();
const frontendUrl = (process.env.FRONTEND_URL || "").trim();
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

console.log("\nPaystack billing setup check\n");

if (billingProvider !== "paystack") {
  fail(
    `BILLING_PROVIDER=${billingProvider || "(unset)"} — set to "paystack" for Paystack checkout (Preview/local).`
  );
} else {
  ok("BILLING_PROVIDER=paystack");
}

if (!paystackKey.startsWith("sk_test_")) {
  fail(
    `PAYSTACK_SECRET_KEY must be sk_test_… for test mode (got ${maskSecret(paystackKey)}). Do not use sk_live_ here.`
  );
} else {
  ok(`PAYSTACK_SECRET_KEY looks like test key (${maskSecret(paystackKey)})`);
}

if (!frontendUrl) {
  fail("FRONTEND_URL is missing — set to your Preview URL or http://localhost:3000 for vercel dev.");
} else {
  ok(`FRONTEND_URL=${frontendUrl}`);
}

if (!supabaseUrl || !serviceRole) {
  fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for checkout.");
  process.exit(process.exitCode || 1);
}

ok("Supabase server credentials present");

const paidPlans = ["investor", "portfolio", "portfolio_pro"];

try {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await sb
    .from("subscription_plans")
    .select("code, name, monthly_price, paystack_plan_code_monthly")
    .in("code", paidPlans)
    .order("sort_order");

  if (error) {
    fail(`Supabase query failed: ${error.message}`);
    process.exit(process.exitCode || 1);
  }

  console.log("\nSupabase plan codes:\n");
  for (const plan of paidPlans) {
    const row = (data ?? []).find((r) => r.code === plan);
    if (!row) {
      fail(`Plan row missing: ${plan}`);
      continue;
    }
    const code = String(row.paystack_plan_code_monthly ?? "").trim();
    if (!code || code.startsWith("REPLACE_")) {
      fail(`${plan}: paystack_plan_code_monthly not set — run supabase/dev/paystack_plan_codes.sql`);
    } else {
      ok(`${plan} → ${code} (R${row.monthly_price}/mo)`);
    }
  }

  if (paystackKey.startsWith("sk_test_")) {
    console.log("\nPaystack API plan validation:\n");
    for (const row of data ?? []) {
      const pln = String(row.paystack_plan_code_monthly ?? "").trim();
      if (!pln || pln.startsWith("REPLACE_")) continue;

      const res = await fetch(`https://api.paystack.co/plan/${encodeURIComponent(pln)}`, {
        headers: { Authorization: `Bearer ${paystackKey}` }
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok || body.status !== true) {
        fail(
          `${row.code}: Paystack does not recognize plan "${pln}" — ${body.message || res.status}`
        );
      } else {
        const amountKobo = Number(body.data?.amount ?? 0);
        const amountZar = amountKobo / 100;
        ok(
          `${row.code}: Paystack plan OK (${body.data?.name ?? pln}, ${amountZar} ZAR/${body.data?.interval ?? "?"})`
        );
      }
    }
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}

console.log(
  process.exitCode
    ? "\nFix the items above, redeploy Preview, then test Settings → Complete payment.\n"
    : "\nReady to test: sign in → Settings → Subscription → Complete payment → Paystack checkout.\n"
);
