# Subscription tiers — manual QA checklist

Use this checklist to verify plan-linked limits and feature gating across all four sellable tiers plus the bootstrap admin account. No payment provider is involved; limits are enforced in the UI and on the server (Supabase triggers/RPCs + Vercel report API).

## Before you start

1. Apply migrations through at least:
   - `20260610120000_subscription_plans_v2_usage_counters.sql`
   - `20260610140000_dev_subscription_test_users.sql`
   - `20260611120000_subscription_server_limits.sql`
   - `20260611140000_user_subscriptions_admin_plan_updates.sql`
2. Seed test users (recommended):

   ```bash
   cd backend
   npm run dev:seed-subscription-users
   ```

   Or follow [`docs/dev/SUBSCRIPTION_TEST_USERS.md`](../dev/SUBSCRIPTION_TEST_USERS.md).
3. Sign out between tier tests (or use separate browser profiles) so session/plan data does not leak.
4. For each run, open **Settings → Subscription** (`/settings?section=subscription`) and confirm plan name, limits, and feature checklist match expectations.

**Default dev password:** `ProplyticDevTest1!` (override with `DEV_TEST_USER_PASSWORD` when seeding).

## Test users

| Account | Email | Expected plan |
|---------|-------|----------------|
| Starter | `proplytic.starter@test.local` | `starter` |
| Investor | `proplytic.investor@test.local` | `investor` |
| Portfolio | `proplytic.portfolio@test.local` | `portfolio` |
| Portfolio Pro | `proplytic.pro@test.local` | `portfolio_pro` |
| Admin | `delangetiaan13@gmail.com` | `portfolio_pro` + `profiles.role = ADMIN` |

---

## Shared verification points

Use these routes/features while testing any tier:

| Area | Where to test |
|------|----------------|
| Subscription dashboard | `/settings?section=subscription` |
| Add property | Owned properties → add property (`/owned-properties/new` or equivalent) |
| Portfolio dashboard | `/owned-properties` (portfolio dashboard) |
| Property overview | Open a property → Overview tab |
| Calculators hub | `/calculators` (property-type flow + report generate) |
| Single calculators | `/calculators/irr`, `/calculators/noi`, etc. |
| My reports | `/dashboard` |
| Applicant links | `/tenants` → Applicants → **Add Applicant** (invite modal) |
| Pricing CTA | Locked features → **Upgrade to Investor** / **View plans** → `/pricing` |

**Pass criteria (general):**

- UI shows locked previews or upgrade prompts; app does not crash.
- Server rejects bypass attempts with a clear error (property insert, report generate, new applicant invite).
- Usage on Settings matches actions (property count, reports this month, active applicant links).

---

## Starter — `proplytic.starter@test.local`

**Expected limits:** 3 properties · 3 reports/month · 1 active applicant link (cap only; `has_application_links` is false on catalog).

### Properties

- [ ] Settings shows property limit **3** and current count.
- [ ] Can create properties until total owned = **3** (success).
- [ ] **4th property** fails in UI with a clear limit/upgrade message.
- [ ] **4th property** fails server-side if attempted via API/Supabase insert (error mentions plan property limit).

### Reports

- [ ] Settings shows report limit **3** per month and usage counter.
- [ ] Can generate up to **3** investment/calculation PDFs in the current month (Calculators hub step 3 and/or `/dashboard` generate).
- [ ] **4th report** in the same month is blocked in UI (upgrade modal or error).
- [ ] **4th report** is blocked by `assert_investment_report_quota` (message: monthly report limit).

### Feature gating (should be locked)

- [ ] **IRR:** `/calculators/irr` shows locked preview / upgrade prompt; CoC/IRR metrics on property overview show **—** or upgrade hint.
- [ ] **Advanced graphs:** Portfolio overview chart and property NOI trend chart locked (blurred preview + upgrade).
- [ ] **Long-term forecasting:** 5-year projection on Calculators hub locked; growth assumption inputs on NOI/cash-flow calculators locked where present.
- [ ] **Portfolio dashboard analytics:** Analysis split (IRR table, projection chart, ranking) locked with *Unlock portfolio analytics with Investor.*
- [ ] Settings feature checklist shows **Locked** for: Full analytics, IRR, Graphs, Forecasting, Portfolio dashboard, Property comparison, Advanced reports, Unlimited reports, Report branding, Team access, Priority support.

### Applicant links

- [ ] Can create **one** active applicant link (first property invite succeeds).
- [ ] **Second** active link on a **different** property is blocked (upgrade/limit message) unless reusing existing per-property invite.
- [ ] Settings shows application link limit **1 active link**.

### Upgrade UX

- [ ] Non-admin user sees **View plans** on Settings → Subscription (links to `/pricing`).
- [ ] Locked features show **Upgrade to Investor** (or plan-appropriate copy), not payment/card fields.

### Basic access (should still work)

- [ ] Can use tenants, leases, statements, invoices, recurring expenses (basic management).
- [ ] Basic calculators (e.g. NOI, cash flow) run without whole-page lock.
- [ ] Basic overview metrics visible: income, expenses, cash flow, occupancy.

---

## Investor — `proplytic.investor@test.local`

**Expected limits:** 10 properties · 10 reports/month · 10 active applicant links.

### Properties

- [ ] Settings shows property limit **10**.
- [ ] Can create up to **10** properties.
- [ ] **11th property** blocked (UI + server).

### Reports

- [ ] Settings shows report limit **10** per month.
- [ ] Can generate up to **10** reports in the current month.
- [ ] **11th report** blocked in the same month.

### Feature gating (should be unlocked)

- [ ] **IRR:** `/calculators/irr` usable; IRR metrics visible on calculators hub and property overview where data exists.
- [ ] **Graphs:** Portfolio overview chart and property NOI trend visible (not blurred lock overlay).
- [ ] **Forecasting:** 5-year projection chart and growth inputs accessible.
- [ ] **Portfolio dashboard:** Analysis split section (detailed table + projection chart) visible without portfolio-dashboard lock.
- [ ] **Property comparison:** Unlocked per Settings checklist (verify comparison UI when that screen exists).
- [ ] Settings shows **Included** for: Full analytics, IRR, Graphs, Forecasting, Portfolio dashboard, Property comparison.
- [ ] Settings still shows **Locked** for: Advanced reports, Unlimited reports, Report branding, Team access (unless plan seed differs).

### Applicant links

- [ ] Can create applicant invites up to **10** active links across properties.
- [ ] **11th** new active invite blocked with upgrade/limit message.

### Upgrade UX

- [ ] **View plans** visible on Settings; no admin plan switcher.

---

## Portfolio — `proplytic.portfolio@test.local`

**Expected limits:** 30 properties · unlimited reports · unlimited application links.

### Properties

- [ ] Settings shows property limit **30** (or “Up to 30 properties”).
- [ ] Can create up to **30** properties.
- [ ] **31st property** blocked.

### Reports

- [ ] Settings shows **Unlimited** reports (or no monthly cap).
- [ ] Can generate more than **10** reports in the same month without quota error (smoke: generate 11+ if environment allows).

### Features

- [ ] **Advanced reports** marked **Included** on Settings.
- [ ] **Unlimited reports** marked **Included** on Settings.
- [ ] **Application links** marked **Included**; can create multiple invites without low-tier cap.
- [ ] **Priority support** marked **Included** on Settings (badge/label visible in feature list).
- [ ] IRR, graphs, forecasting, portfolio dashboard, property comparison all **Included**.

### Upgrade UX

- [ ] No admin switcher; **View plans** available.

---

## Portfolio Pro — `proplytic.pro@test.local`

**Expected limits:** unlimited properties · unlimited reports · unlimited application links.

### Properties

- [ ] Settings shows **Unlimited** properties (or no numeric cap).
- [ ] Can create **31+** properties without plan property error (smoke test if data setup allows).

### Reports

- [ ] Unlimited monthly reports (no quota error after many generations).

### Features

- [ ] Settings feature checklist: **all** tier flags **Included**, including:
  - [ ] Advanced reports
  - [ ] Unlimited reports
  - [ ] Report branding
  - [ ] Team access
  - [ ] Priority support
- [ ] Branding/team: verify in UI wherever implemented (PDF branding, team settings); if not built yet, confirm checklist shows **Included** and document “UI N/A” in test notes.

### Upgrade UX

- [ ] No admin switcher.

---

## Admin — `delangetiaan13@gmail.com`

**Expected:** `profiles.role = ADMIN` · bypass all limits · all features enabled.

### Identity & settings

- [ ] **Admin** badge visible on Settings → Subscription.
- [ ] Admin plan switcher visible (starter / investor / portfolio / portfolio_pro) for dev testing.
- [ ] Switching plan in switcher updates `user_subscriptions` and refreshes gated UI (smoke one switch).

### Limits (bypass)

- [ ] Can exceed starter/investor property caps while admin (e.g. 4+ properties without plan error).
- [ ] Can exceed monthly report caps while admin.
- [ ] Applicant link creation not blocked by tier caps.

### Features

- [ ] All features show **Included** on Settings (admin entitlement).
- [ ] No upgrade lock overlays on IRR, graphs, forecasting, portfolio analytics when viewing as admin.

### Security note (optional spot-check)

- [ ] Non-admin test user **cannot** change `plan_code` via Settings (no switcher; direct Supabase update rejected by trigger if attempted).

---

## Regression smoke (all tiers)

Run once per release candidate:

- [ ] Login/logout and Settings subscription panel load without errors.
- [ ] `/pricing` loads; no card collection on Settings.
- [ ] Server limit errors are human-readable (not raw SQL).
- [ ] Report usage increments only after successful PDF generation (check counter on Settings after one successful report).

---

## Test log template

| Date | Tester | Account | Area | Pass/Fail | Notes |
|------|--------|---------|------|-----------|-------|
| | | starter | properties | | |
| | | starter | reports | | |
| | | investor | IRR/graphs | | |
| | | portfolio | unlimited reports | | |
| | | admin | bypass | | |

---

## Related docs

- Dev seeding and `set_user_plan`: [`docs/dev/SUBSCRIPTION_TEST_USERS.md`](../dev/SUBSCRIPTION_TEST_USERS.md)
- Plan catalog columns: migration `20260610120000_subscription_plans_v2_usage_counters.sql`
