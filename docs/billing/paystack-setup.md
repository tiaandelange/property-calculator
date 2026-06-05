# Paystack billing setup (manual dashboard + env)

This guide covers the **manual Paystack dashboard work** and **environment configuration** required before enabling live Paystack billing in Proplytic.

Proplytic billing is provider-agnostic. Checkout uses `POST /api/subscription/checkout`. The Paystack provider implementation lives in `frontend/api/lib/billing/paystackProvider.ts` and must be complete before you set `BILLING_PROVIDER=paystack` in production.

Until then, use `BILLING_PROVIDER=mock` (default in local/preview) for development.

---

## Prerequisites

- Supabase migration `20260612120000_billing_provider_plan_codes.sql` applied (`paystack_plan_code_monthly`, `paystack_plan_code_annual` on `subscription_plans`).
- Vercel project root directory set to `frontend`.
- Production site URL: `https://www.proplytic.co.za`.

---

## 1. Create a Paystack account

1. Sign up at [https://paystack.com](https://paystack.com).
2. Complete business verification (KYC) for your company.
3. Enable **Test mode** while integrating; switch to **Live mode** only after checkout and webhooks pass in test.

---

## 2. Confirm ZAR support

1. In Paystack Dashboard → **Settings** → **Preferences**, confirm your business currency is **ZAR (South African Rand)**.
2. Ensure settlement/bank details support ZAR payouts.
3. All Proplytic sellable plans are priced in ZAR (`subscription_plans.currency = 'ZAR'`).

If ZAR is unavailable on your account, contact Paystack support before creating plans.

---

## 3. Create plans in Paystack

Create **subscription plans** (recurring) in Paystack Dashboard → **Plans** that match Proplytic tiers.

### Required monthly plans

| Proplytic plan code | Display name   | Amount (ZAR) | Interval |
| ------------------- | -------------- | ------------ | -------- |
| `investor`          | Investor       | **R299**     | Monthly  |
| `portfolio`         | Portfolio      | **R599**     | Monthly  |
| `portfolio_pro`     | Portfolio Pro  | **R999**     | Monthly (if you sell self-serve checkout for this tier) |

**Notes:**

- **Starter is free** — do **not** create a Paystack plan for `starter`. Signup assigns Starter with `status = active` and no checkout.
- **Portfolio Pro** may be contact-sales only on the marketing site. Create the Paystack plan only if you intend to offer self-serve checkout for that tier.
- Plan names in Paystack can differ from Proplytic display names; what matters is the **plan code / ID** you store in Supabase (see step 5).

### Optional annual plans (later)

Proplytic annual pricing bills **10 months** of the listed monthly price (not 12). When you add annual checkout:

1. Create separate annual plans in Paystack (or map one Paystack plan per annual SKU).
2. Store codes in `paystack_plan_code_annual` (step 5).
3. Checkout requests must send `billingPeriod: "annual"`.

You can ship monthly billing first and add annual plans in a follow-up.

---

## 4. Copy Paystack plan codes

After each plan is created, copy its **Plan code** or **Plan ID** from the Paystack dashboard (the exact field name depends on Paystack UI/API version).

You will map:

| `subscription_plans.code` | Supabase column (monthly)        | Supabase column (annual, optional) |
| ------------------------- | -------------------------------- | ---------------------------------- |
| `investor`                | `paystack_plan_code_monthly`     | `paystack_plan_code_annual`        |
| `portfolio`               | `paystack_plan_code_monthly`     | `paystack_plan_code_annual`        |
| `portfolio_pro`           | `paystack_plan_code_monthly`     | `paystack_plan_code_annual`        |

Keep these values server-side only. They are read by the billing API via the Supabase service role — never expose them in the browser.

---

## 5. Insert plan codes into Supabase

In **Supabase Dashboard → SQL Editor** (or a migration), update `subscription_plans`:

```sql
-- Replace PLN_xxx with your Paystack plan codes from the dashboard.

UPDATE public.subscription_plans
SET paystack_plan_code_monthly = 'PLN_investor_monthly'
WHERE code = 'investor';

UPDATE public.subscription_plans
SET paystack_plan_code_monthly = 'PLN_portfolio_monthly'
WHERE code = 'portfolio';

UPDATE public.subscription_plans
SET paystack_plan_code_monthly = 'PLN_portfolio_pro_monthly'
WHERE code = 'portfolio_pro';

-- Optional annual codes (when annual checkout is enabled):
-- UPDATE public.subscription_plans
-- SET paystack_plan_code_annual = 'PLN_investor_annual'
-- WHERE code = 'investor';
```

Verify:

```sql
SELECT code, name, monthly_price, paystack_plan_code_monthly, paystack_plan_code_annual
FROM public.subscription_plans
WHERE is_active = true
ORDER BY sort_order;
```

**Do not** set Paystack codes on `starter`.

---

## 6. Configure the webhook URL

In Paystack Dashboard → **Settings** → **Webhooks**, set:

```text
https://www.proplytic.co.za/api/subscription/webhook
```

For **preview/staging**, add a separate Paystack test webhook pointing at your preview host, for example:

```text
https://<preview-host>/api/subscription/webhook
```

**Important:**

- Use **HTTPS** only.
- The route must accept **POST** with a raw body (signature verification).
- Paystack may retry failed deliveries; Proplytic deduplicates events in `webhook_events` (see [Architecture notes](#architecture-notes) below).

After saving, copy Paystack’s **webhook secret** (if provided) for server env — store it server-side only, never under a `VITE_` prefix.

---

## 7. Add Vercel environment variables

Set these in **Vercel → Project → Settings → Environment Variables**. Server-only values must **never** use a `VITE_` prefix (see [§8](#8-confirm-no-paystack-secrets-use-vite_)).

### Development (local)

| Variable | Value | Required |
| -------- | ----- | -------- |
| `BILLING_PROVIDER` | `mock` | Yes |
| `FRONTEND_URL` | `http://localhost:5173` (or your Vite dev port) | Yes |
| `SUPABASE_URL` | `https://<project>.supabase.co` | Yes (checkout + plans) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role secret | Yes (checkout + webhooks) |

Optional for local Paystack integration testing:

| Variable | Value |
| -------- | ----- |
| `BILLING_PROVIDER` | `paystack` |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` |

Paid checkout **fails with HTTP 503** if `FRONTEND_URL` is missing. Mock billing is **blocked in production** (see below).

### Preview (Vercel)

| Variable | Value |
| -------- | ----- |
| `BILLING_PROVIDER` | `mock` or `paystack` |
| `FRONTEND_URL` | `https://<preview-host>` |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` when testing Paystack |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Same as production project |

### Production

| Variable | Example / notes | Required |
| -------- | --------------- | -------- |
| `BILLING_PROVIDER` | `paystack` | Yes |
| `PAYSTACK_SECRET_KEY` | `sk_live_…` | Yes |
| `SUPABASE_URL` | `https://<project>.supabase.co` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role secret from Supabase | Yes |
| `FRONTEND_URL` | `https://www.proplytic.co.za` | Yes |

Also ensure existing public Supabase client vars remain set for the SPA:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Do not** set `VITE_API_BASE_URL` in production unless you intentionally use a separate API origin (default is same-origin `/api`).

### Config validation (server)

`POST /api/subscription/checkout` calls `assertBillingCheckoutConfig()` before creating a session:

| Condition | Result |
| --------- | ------ |
| `BILLING_PROVIDER=mock` in production | HTTP **503** — mock blocked |
| `BILLING_PROVIDER=paystack` without `PAYSTACK_SECRET_KEY` | HTTP **503** |
| Missing `FRONTEND_URL` | HTTP **503** |

Implementation: `frontend/api/lib/billing/billingEnv.ts`.

Redeploy after changing env vars.

---

## 8. Confirm no Paystack secrets use `VITE_`

Anything prefixed with `VITE_` is **embedded in the browser bundle** and is public.

| OK (server) | Never (client) |
| ----------- | -------------- |
| `PAYSTACK_SECRET_KEY` | `VITE_PAYSTACK_SECRET_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `VITE_SUPABASE_SERVICE_ROLE_KEY` |
| `BILLING_PROVIDER` | `VITE_BILLING_PROVIDER` |

The frontend calls `POST /api/subscription/checkout` with the user’s session JWT only. Paystack secrets stay on Vercel serverless functions.

See also [`docs/SECRETS.md`](../SECRETS.md).

---

## 9. Use Paystack test keys first

1. Keep Paystack Dashboard in **Test mode**.
2. Set `PAYSTACK_SECRET_KEY=sk_test_…` on a **Preview** deployment (or local with Vercel CLI / API dev).
3. Set `BILLING_PROVIDER=paystack` only on that environment once the Paystack provider is implemented.
4. Use Paystack test cards (see Paystack docs) for successful and failed payments.

Do **not** put live keys (`sk_live_…`) on preview or in git.

---

## 10. Test checkout and webhook before live keys

### Checkout flow

1. Sign up or sign in as a non-admin user.
2. Choose a **paid** plan (e.g. Investor) — signup creates `user_subscriptions` with `status = pending_payment`.
3. Open **Settings → Subscription** → **Complete payment** (or POST checkout from API).
4. Confirm redirect to Paystack hosted checkout and return to `/subscription/success`.
5. Until the webhook fires, the user should have **Starter-level access** (`pending_payment` entitlement rule).

### Webhook flow

1. Complete a **test** payment in Paystack.
2. Confirm Paystack delivers an event to `/api/subscription/webhook`.
3. In Supabase, verify:
   - `webhook_events` has a row with `provider = 'paystack'` and a unique `provider_event_id`.
   - `user_subscriptions` for that user shows `status = active`, correct `plan_code`, and `payment_provider = 'paystack'`.
4. Confirm the user receives **full plan entitlements** after activation.

### Idempotency check

1. Replay the same webhook (Paystack retry or manual resend).
2. Confirm `webhook_events` does not double-apply billing (unique constraint on `(provider, provider_event_id)`).
3. Confirm `user_subscriptions` is unchanged after the first successful processing.

### Go live

1. Switch Paystack to **Live mode**.
2. Replace `PAYSTACK_SECRET_KEY` with `sk_live_…` in **Production** only.
3. Update the production webhook URL if Paystack requires re-registration for live.
4. Run one real low-value transaction and monitor Vercel function logs.

---

## Architecture notes

### Starter is free — no checkout

- `starter` has `monthly_price = 0`.
- `POST /api/subscription/checkout` rejects Starter with: *"Starter is free and does not require checkout."*
- Signup with `?plan=starter` creates an active subscription with no payment step.

### `user_subscriptions` is the source of truth

- Plan tier, status, and payment linkage live in `public.user_subscriptions`.
- Webhooks and the billing API update this table via the **Supabase service role** only.
- Authenticated clients can **read** their own row; they cannot write payment fields.
- Legacy `profiles.subscription_status` / Stripe-era tables are not updated by the v2 Paystack flow.

**Typical lifecycle:**

| Stage | `plan_code` | `status` | Entitlements |
| ----- | ----------- | -------- | ------------ |
| Free signup | `starter` | `active` | Starter |
| Paid signup (pre-payment) | `investor` / `portfolio` / … | `pending_payment` | **Starter** until webhook |
| After successful webhook | selected plan | `active` | Selected plan |
| Portfolio trial (if configured) | `portfolio` | `trialing` | Portfolio |

### `webhook_events` prevents duplicate processing

Table: `public.webhook_events`

- Unique key: `(provider, provider_event_id)`.
- RLS: **no** client access — service role only.
- Handler logic (in `frontend/api/lib/billing/billingSubscriptionSync.ts`) records events before/after processing and skips already-processed IDs.

This protects against Paystack retries and duplicate deliveries.

### Related code paths

| Path | Purpose |
| ---- | ------- |
| `POST /api/subscription/checkout` | Start hosted checkout (`planCode`, `billingPeriod`) |
| `POST /api/subscription/webhook` | Provider webhook ingress (Paystack when enabled) |
| `frontend/api/lib/billing/paystackProvider.ts` | Paystack checkout + signature verification |
| `frontend/api/lib/billing/billingSubscriptionSync.ts` | Activate/cancel + webhook idempotency |
| `supabase/migrations/20260612120000_billing_provider_plan_codes.sql` | Plan code columns + `webhook_events` / `checkout_attempts` |

### Dev without Paystack

- Local / preview default: `BILLING_PROVIDER=mock` (or unset in non-production).
- Mock checkout redirects to `/subscription/success?mock=true` for UI testing.
- Mock completion API is **dev/preview only** — it must not activate paid plans in production.

See [`docs/dev/SUBSCRIPTION_TEST_USERS.md`](../dev/SUBSCRIPTION_TEST_USERS.md) for tier testing without payments.

### Stripe retirement (legacy)

Stripe is **not** used for new checkout. Active billing uses `POST /api/subscription/checkout` with `BILLING_PROVIDER=paystack` (or `mock` in dev).

| Item | Status |
| ---- | ------ |
| New checkout | Paystack / mock via `frontend/api/lib/billing/*` |
| Billing writes | `user_subscriptions`, `webhook_events`, `checkout_attempts` only |
| Legacy Stripe module | `frontend/api/lib/stripeSubscriptionServer.ts` — deprecated, retained until Paystack is confirmed live |
| Legacy tables | `profiles.subscription_status` and `public.subscriptions` are **not** updated by new flows; historical rows are preserved |
| `/subscription` route | Redirects to `/settings?section=subscription` |
| Stripe webhook | Still verified if `Stripe-Signature` is present, but acknowledged without legacy writes |

After Paystack is confirmed in production: remove the `stripe` npm package if unused, archive `stripeSubscriptionServer.ts`, and rotate off `STRIPE_*` env vars.

---

## Pre-launch checklist

- [ ] Paystack account verified; ZAR enabled
- [ ] Monthly plans created (R299 / R599 / R999 as applicable)
- [ ] `paystack_plan_code_monthly` set on paid rows in `subscription_plans`
- [ ] Webhook URL `https://www.proplytic.co.za/api/subscription/webhook` configured
- [ ] Vercel env: `BILLING_PROVIDER`, `PAYSTACK_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`
- [ ] No Paystack or service-role secrets under `VITE_`
- [ ] Test-mode checkout + webhook end-to-end on preview
- [ ] Idempotent webhook verified (replay does not double-charge state)
- [ ] Live keys and webhook only on production after successful test run
