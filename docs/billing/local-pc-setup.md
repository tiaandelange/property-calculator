# Local PC setup — billing (mock + Paystack test)

Step-by-step checklist to run Proplytic billing on your **home / local Windows PC** after pulling the latest code from Git.

Related: [`paystack-setup.md`](paystack-setup.md) (Paystack dashboard + production), [`../SECRETS.md`](../SECRETS.md), [`../dev/SUBSCRIPTION_TEST_USERS.md`](../dev/SUBSCRIPTION_TEST_USERS.md).

---

## 1. Pull the latest code

| Step | Action | Notes |
| ---- | ------ | ----- |
| 1.1 | Open PowerShell or Git Bash | |
| 1.2 | `cd` to your clone folder | e.g. `C:\Users\<you>\property-calculator` |
| 1.3 | `git pull origin main` | Use your branch name if not on `main` |
| 1.4 | Confirm billing files exist | `frontend/api/lib/billing/`, `docs/billing/` |

---

## 2. Install prerequisites

| Tool | Minimum | Install | Verify |
| ---- | ------- | ------- | ------ |
| Node.js | 20.x LTS | [nodejs.org](https://nodejs.org/) | `node -v` |
| npm | 10+ (bundled with Node) | Comes with Node | `npm -v` |
| Git | any recent | [git-scm.com](https://git-scm.com/) | `git --version` |
| Vercel CLI | latest | `npm i -g vercel` | `vercel --version` |

Optional: Supabase CLI if you apply migrations locally (`npm i -g supabase`).

---

## 3. Install dependencies

| Step | Command | Where |
| ---- | ------- | ----- |
| 3.1 | `npm ci` | `frontend/` |
| 3.2 | `npm ci` | `backend/` (shared scripts + calculator tests) |

---

## 4. Supabase — migrations & plan codes

Apply on your **hosted Supabase project** (Dashboard → SQL Editor or Supabase CLI).

| Step | Action | Required for billing |
| ---- | ------ | -------------------- |
| 4.1 | Apply all migrations through `20260612120000_billing_provider_plan_codes.sql` | Yes |
| 4.2 | Confirm `subscription_plans` has rows: `starter`, `investor`, `portfolio`, `portfolio_pro` | Yes |
| 4.3 | After Paystack plans exist, set `paystack_plan_code_monthly` on paid rows | Only for Paystack test/live |

Quick verify:

```sql
SELECT code, monthly_price, paystack_plan_code_monthly
FROM public.subscription_plans
WHERE is_active = true
ORDER BY sort_order;
```

---

## 5. Environment variables

### 5a. Frontend (browser) — `frontend/.env.local`

Copy template: `cp frontend/.env.example frontend/.env.local` (or copy manually on Windows).

| Variable | Local value | Rule |
| -------- | ----------- | ---- |
| `VITE_SUPABASE_URL` | Your Supabase project URL | Public — OK in bundle |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon** key | Public — OK in bundle |
| `VITE_API_BASE_URL` | **Leave unset** when using `vercel dev` | Same-origin `/api` |

**Never** add `PAYSTACK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or any `VITE_PAYSTACK_*` here.

### 5b. Server (checkout + webhooks) — Vercel CLI / `.env.local` in `frontend/`

When running `vercel dev`, put **server-only** vars in `frontend/.env.local` (Vercel loads them for `/api/*`).

**Mock billing (recommended first):**

| Variable | Value |
| -------- | ----- |
| `BILLING_PROVIDER` | `mock` |
| `FRONTEND_URL` | `http://localhost:5173` |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → Settings → API → **service_role** |

**Paystack test mode (optional, after mock works):**

| Variable | Value |
| -------- | ----- |
| `BILLING_PROVIDER` | `paystack` |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` from Paystack dashboard |
| `FRONTEND_URL` | `http://localhost:5173` |
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |

---

## 6. Run the app locally

Billing checkout uses Vercel serverless routes (`/api/subscription/*`). **Use `vercel dev`**, not Vite alone.

| Step | Command | Where |
| ---- | ------- | ----- |
| 6.1 | `vercel link` | `frontend/` — link to your Vercel project (first time only) |
| 6.2 | `vercel dev` | `frontend/` — serves SPA + `/api/*` (default port often **3000**) |
| 6.3 | Open the URL shown in the terminal | e.g. `http://localhost:3000` |

If you use port 3000 instead of 5173, set `FRONTEND_URL=http://localhost:3000` to match.

**Alternative:** `npm run dev` (Vite on 5173) works for UI-only work; **checkout and webhooks will not work** without `/api` routes.

---

## 7. Mock billing — smoke test

| # | Test | Steps | Expected |
| - | ---- | ----- | -------- |
| 7.1 | Starter signup | `/signup?plan=starter` → register | `user_subscriptions`: `plan_code=starter`, `status=active` |
| 7.2 | Investor signup | `/signup?plan=investor` → register | `status=pending_payment`; Starter-level features in app |
| 7.3 | Complete payment | Settings → Subscription → **Complete payment** | Redirect to `/subscription/success?mock=true&…` |
| 7.4 | Mock activate (dev only) | On success page in dev | Optional auto/mock complete → `status=active` |
| 7.5 | Admin bypass | Sign in as admin | All features regardless of plan |

Confirm in Supabase → Table Editor → `user_subscriptions`.

---

## 8. Paystack test mode — smoke test

Complete [`paystack-setup.md`](paystack-setup.md) dashboard steps first (plans, webhook URL, plan codes in DB).

| # | Test | Steps | Expected |
| - | ---- | ----- | -------- |
| 8.1 | Checkout URL | Settings → Complete payment (Investor) | Browser goes to `checkout.paystack.com/…` |
| 8.2 | Success redirect | Pay with Paystack test card | Lands on `/subscription/success` |
| 8.3 | Webhook | Paystack sends POST to your webhook URL | Row in `webhook_events`; `user_subscriptions.status=active` |
| 8.4 | Idempotency | Replay same webhook in Paystack dashboard | No double activation; `alreadyProcessed` in API response |
| 8.5 | Failed payment | Trigger `invoice.payment_failed` (test) | `user_subscriptions.status=past_due` |

**Local webhook:** Paystack cannot reach `localhost`. Use one of:

- Deploy a **Vercel preview** and point Paystack test webhook at `https://<preview>/api/subscription/webhook`, or  
- Use a tunnel (ngrok, Cloudflare Tunnel) to expose local `vercel dev` HTTPS URL.

---

## 9. Automated checks (run before you push/deploy)

| Step | Command | Where |
| ---- | ------- | ----- |
| 9.1 | `npm run verify:public-env` | `frontend/` |
| 9.2 | `npm run test:ci` | `frontend/` |
| 9.3 | `npm run typecheck` | `frontend/` |
| 9.4 | `npm run build` | `frontend/` |

---

## 10. Production cutover (when ready)

| Step | Action |
| ---- | ------ |
| 10.1 | Vercel Production env: `BILLING_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY=sk_live_…`, `FRONTEND_URL=https://www.proplytic.co.za` |
| 10.2 | Paystack live webhook: `https://www.proplytic.co.za/api/subscription/webhook` |
| 10.3 | Confirm **no** `BILLING_PROVIDER=mock` in production |
| 10.4 | Remove legacy `STRIPE_*` env vars after Paystack is confirmed live |
| 10.5 | Redeploy Vercel (uncheck “Use existing Build Cache”) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| Checkout returns 503 “FRONTEND_URL is not configured” | Missing server env | Set `FRONTEND_URL` in `frontend/.env.local` for `vercel dev` |
| Checkout returns 503 “mock is not allowed in production” | Wrong env on preview/prod | Use `paystack` in production; `mock` only locally/preview |
| `/api/subscription/checkout` 404 | Vite-only dev server | Use `vercel dev` from `frontend/` |
| Paystack webhook never fires | localhost not reachable | Preview deploy or tunnel |
| Payment success but still `pending_payment` | Webhook not processed | Check `webhook_events`, Vercel function logs, `PAYSTACK_SECRET_KEY` |

---

## Quick reference — env by environment

| Environment | `BILLING_PROVIDER` | `FRONTEND_URL` | `PAYSTACK_SECRET_KEY` |
| ----------- | ------------------ | -------------- | --------------------- |
| Local mock | `mock` | `http://localhost:5173` or `:3000` | — |
| Local / preview Paystack test | `paystack` | Your dev/preview URL | `sk_test_…` |
| Production | `paystack` | `https://www.proplytic.co.za` | `sk_live_…` |
