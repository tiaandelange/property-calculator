# Connect Paystack test plans to Complete Payment

Use this after you have **three Paystack subscription plans** in **Test mode** (Investor R299, Portfolio R599, Portfolio Pro R999).

Complete Payment in **Settings → Subscription** calls `POST /api/subscription/checkout`, which reads your Paystack plan codes from Supabase and redirects to `https://checkout.paystack.com/…`.

---

## Overview

| Layer | What you configure |
| ----- | ------------------ |
| Paystack (test) | 3 monthly plans + webhook URL + `sk_test_…` secret |
| Supabase | `paystack_plan_code_monthly` on `investor`, `portfolio`, `portfolio_pro` |
| Vercel **Preview** (recommended) or local `vercel dev` | `BILLING_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY`, `FRONTEND_URL`, Supabase server keys |

Do **not** use `sk_live_…` or change production billing until test checkout and webhooks pass on Preview.

---

## Step 1 — Copy Paystack plan codes

Paystack Dashboard → **Plans** (ensure **Test mode** toggle is ON) → open each plan:

| Paystack plan (your naming) | Proplytic `subscription_plans.code` | Expected amount |
| ------------------------- | ------------------------------------- | ----------------- |
| Investor (R299/mo) | `investor` | R299 |
| Portfolio (R599/mo) | `portfolio` | R599 |
| Portfolio Pro (R999/mo) | `portfolio_pro` | R999 |

Copy the **Plan code** (starts with `PLN_`). This is **not** the public payment link — the app builds checkout via API using this code.

---

## Step 2 — Map codes in Supabase

1. Open [`supabase/dev/paystack_plan_codes.sql`](../../supabase/dev/paystack_plan_codes.sql).
2. Replace the three `REPLACE_WITH_…` placeholders with your `PLN_…` codes.
3. Run the script in **Supabase → SQL Editor**.

Confirm:

```sql
SELECT code, monthly_price, paystack_plan_code_monthly
FROM public.subscription_plans
WHERE code IN ('investor', 'portfolio', 'portfolio_pro');
```

Each row must have a non-null `paystack_plan_code_monthly`.

---

## Step 3 — Vercel Preview environment (recommended)

Paystack cannot POST webhooks to `localhost`. Use a **Preview deployment** for end-to-end test.

Vercel → Project → **Settings → Environment Variables** → scope **Preview** only:

| Variable | Value |
| -------- | ----- |
| `BILLING_PROVIDER` | `paystack` |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` (Paystack → Settings → API Keys → **Test**) |
| `FRONTEND_URL` | `https://<your-preview-url>` (exact host, no trailing slash) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) |

Keep existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Preview builds.

Redeploy Preview (uncheck **Use existing Build Cache**).

---

## Step 4 — Paystack test webhook

Paystack Dashboard → **Settings → Webhooks** (Test mode):

```text
https://<your-preview-url>/api/subscription/webhook
```

Example:

```text
https://property-calculator-abc123.vercel.app/api/subscription/webhook
```

After a test payment, check Supabase:

- `webhook_events` — new row with `provider = paystack`
- `user_subscriptions` — `status = active`, `payment_provider = paystack`

---

## Step 5 — Local alternative (`vercel dev`)

If you prefer your home PC:

| Step | Action |
| ---- | ------ |
| 1 | Copy `frontend/.env.example` → `frontend/.env.local` |
| 2 | Set `VITE_SUPABASE_*` (browser) |
| 3 | Set server vars in the same file (see `.env.example` billing section) |
| 4 | `BILLING_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY=sk_test_…`, `FRONTEND_URL=http://localhost:3000` |
| 5 | From `frontend/`: `vercel dev` |
| 6 | Use **ngrok** or similar HTTPS tunnel for webhook, OR test checkout only on Preview |

Verify wiring:

```bash
cd frontend
node scripts/verify-paystack-billing-setup.mjs
```

(Load env first: `vercel env pull .env.local` or paste vars into `.env.local`.)

---

## Step 6 — Test Complete Payment

| Step | Action | Expected |
| ---- | ------ | -------- |
| 1 | Sign up or use account with `user_subscriptions.status = pending_payment` (e.g. Investor signup) | Settings shows **Complete payment** |
| 2 | Click **Complete payment** | Browser goes to **Paystack hosted checkout** (not `/subscription/success?mock=true`) |
| 3 | DevTools → Network → `POST /api/subscription/checkout` | `"provider": "paystack"`, `checkoutUrl` starts with `https://checkout.paystack.com/` |
| 4 | Pay with Paystack test card | Return to `/subscription/success` |
| 5 | Refresh / wait for webhook | `user_subscriptions.status = active` |

Paystack test card (typical): `4084 0840 8408 4081`, any future expiry, CVV `408`, PIN `0000` (see [Paystack test payments](https://paystack.com/docs/payments/test-payments/)).

---

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Redirect to `/subscription/success?mock=true` | Preview/local still on `BILLING_PROVIDER=mock` — set `paystack` and redeploy |
| 503 `PAYSTACK_SECRET_KEY is not configured` | Add `sk_test_…` to Preview/server env |
| 503 `Missing paystack_plan_code_monthly` | Run Step 2 SQL with real `PLN_…` codes |
| 503 `FRONTEND_URL is not configured` | Set `FRONTEND_URL` to preview URL |
| Paystack page loads but payment doesn’t activate plan | Webhook URL wrong or not reachable — use Preview HTTPS URL |
| Still `pending_payment` after paying | Check Vercel function logs for `/api/subscription/webhook` |

---

## When test passes → production

Only after Preview test succeeds:

1. Create **live** plans in Paystack (Live mode).
2. Update `paystack_plan_code_monthly` with **live** plan codes (or separate Supabase values if codes differ).
3. Vercel **Production** env: `BILLING_PROVIDER=paystack`, `sk_live_…`, `FRONTEND_URL=https://www.proplytic.co.za`.
4. Paystack **Live** webhook → `https://www.proplytic.co.za/api/subscription/webhook`.

See [`paystack-setup.md`](paystack-setup.md) for the full checklist.
