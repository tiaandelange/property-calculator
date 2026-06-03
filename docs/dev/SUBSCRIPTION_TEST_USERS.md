# Subscription tier test users (dev / local)

Use four dedicated accounts to exercise **starter**, **investor**, **portfolio**, and **portfolio_pro** without payments or Stripe.

## Security model

| Mechanism | Who can use it |
|-----------|----------------|
| `public.set_user_plan(email, plan)` | **service_role** JWT or **postgres** (SQL Editor) only — **not** granted to `authenticated` |
| `backend/scripts/dev/seed-subscription-test-users.mjs` | Runs locally/CI with `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env` — **never** in frontend |
| Signup on `@test.local` tier emails | `handle_new_user` auto-assigns the mapped plan (normal signup path) |

RLS is unchanged: users still only read their own `user_subscriptions` and `usage_counters`.

Server-side limits (migration `20260611120000_subscription_server_limits.sql`):

- **Properties:** `BEFORE INSERT` trigger calls `assert_can_create_property` (plan `max_properties`).
- **Reports:** `assert_investment_report_quota` before PDF generation; `increment_usage_reports_generated` only after success in `frontend/api/reports/generate.ts`.
- **Applicant links:** `get_or_create_applicant_invite` calls `assert_can_create_application_link` when creating a new invite row.

Bypass: `profiles.role = ADMIN`, bootstrap email (`delangetiaan13@gmail.com`), or legacy `subscription_status = SUBSCRIBED`.

## Test accounts

| Email | Plan | Dev password (default) |
|-------|------|-------------------------|
| `proplytic.starter@test.local` | `starter` | `ProplyticDevTest1!` |
| `proplytic.investor@test.local` | `investor` | same (override with `DEV_TEST_USER_PASSWORD`) |
| `proplytic.portfolio@test.local` | `portfolio` | same |
| `proplytic.pro@test.local` | `portfolio_pro` | same |

## Owner admin (all features)

| Email | Access |
|-------|--------|
| `delangetiaan13@gmail.com` | `profiles.role = ADMIN`, unlimited RPC bypass, `user_subscriptions.plan_code = portfolio_pro` |

Configured by migration `20260530120000_bootstrap_admin_delangetiaan.sql` and reaffirmed by `set_user_plan(..., 'portfolio_pro')`.

## Quick start

1. Apply migrations through `20260610140000_dev_subscription_test_users.sql`:

   ```bash
   supabase db push
   ```

2. Set server env in `backend/.env` (not frontend):

   ```env
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role secret>
   # optional:
   DEV_TEST_USER_PASSWORD=YourLocalTestPassword
   ```

3. Seed auth users + plans:

   ```bash
   cd backend
   npm run dev:seed-subscription-users
   ```

4. Sign in at `/login` with each test email and confirm limits in **Settings → Subscription**.

## Manual alternative (no Node)

1. Create each user in **Supabase Dashboard → Authentication → Users** (confirmed email).
2. In **SQL Editor** (runs as `postgres`), execute:

   `supabase/dev/seed_subscription_test_users.sql`

## Change a user’s plan (dev)

From a machine with the service role key:

```bash
cd backend
node -e "
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await sb.rpc('set_user_plan', {
  target_email: 'proplytic.investor@test.local',
  new_plan: 'portfolio'
});
console.log(error || 'ok');
"
```

Or in SQL Editor:

```sql
SELECT public.set_user_plan('proplytic.investor@test.local', 'portfolio');
```

## What is not included

- No PayFast/Stripe wiring
- No public HTTP admin route
- No service role key in `frontend/` or `VITE_*` env

## Related migrations

- `20260610120000_subscription_plans_v2_usage_counters.sql` — plan catalog + limits
- `20260610140000_dev_subscription_test_users.sql` — test emails, `set_user_plan`, signup hook
