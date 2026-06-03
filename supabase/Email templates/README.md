# Supabase Auth email templates (Proplytic)

HTML sources for **Supabase Dashboard → Authentication → Email Templates**.  
These are **not** applied by migrations — paste each file into the matching template in the dashboard.

## Before you paste

1. **Site URL** — **Authentication → URL configuration → Site URL** must match your app (e.g. `https://proplytic.co.za`) so the logo loads: `/proplytic_logo_600x200_nobg.png`.
2. **Redirect URLs** — Include auth callback routes (e.g. `/confirm-email`, `/login`, password reset path).
3. **Security notifications** — For notification templates, enable each type under **Authentication → Email Templates** (or **Security notifications**) so Supabase sends them.
4. **Disable link tracking** on custom SMTP (Resend, etc.) so `{{ .ConfirmationURL }}` is not rewritten.

## Template index

| Supabase dashboard template | Repo file | Suggested subject |
| --- | --- | --- |
| Confirm signup | [`confirm-signup.html`](./confirm-signup.html) | `Confirm your Proplytic email` |
| Invite user | [`invite-user.html`](./invite-user.html) | `You're invited to Proplytic` |
| Magic link | [`magic-link.html`](./magic-link.html) | `Your Proplytic sign-in link` |
| Change email address | [`change-email.html`](./change-email.html) | `Confirm your new Proplytic email` |
| Reset password | [`reset-password.html`](./reset-password.html) | `Reset your Proplytic password` |
| Reauthentication | [`reauthentication.html`](./reauthentication.html) | `{{ .Token }} is your Proplytic verification code` |
| Password changed | [`password-changed.html`](./password-changed.html) | `Your Proplytic password was changed` |
| Email address changed | [`email-address-changed.html`](./email-address-changed.html) | `Your Proplytic email address was changed` |
| Phone number changed | [`phone-number-changed.html`](./phone-number-changed.html) | `Your Proplytic phone number was changed` |
| Sign-in method linked | [`sign-in-method-linked.html`](./sign-in-method-linked.html) | `A sign-in method was linked to your Proplytic account` |
| Sign-in method removed | [`sign-in-method-removed.html`](./sign-in-method-removed.html) | `A sign-in method was removed from your Proplytic account` |
| MFA method added * | [`mfa-method-added.html`](./mfa-method-added.html) | `An MFA method was added to your Proplytic account` |
| MFA method removed * | [`mfa-method-removed.html`](./mfa-method-removed.html) | `An MFA method was removed from your Proplytic account` |

\* In newer Supabase dashboards these may appear as **Verification method added** / **Verification method removed**.

## How to upload

For each row:

1. Open the template in the Supabase dashboard.
2. Set **Subject** to the suggested line (or your preference).
3. Paste the **entire** contents of the `.html` file into the body editor (source/HTML mode if available).
4. Save.

## Variables by template

| Variable | Used in |
| --- | --- |
| `{{ .ConfirmationURL }}` | Confirm signup, Invite, Magic link, Change email, Reset password, Reauthentication (fallback link) |
| `{{ .Token }}` | Magic link, Reset password (OTP), Reauthentication (primary) |
| `{{ .SiteURL }}` | All (logo + home link) |
| `{{ .Email }}` | Reset password, security notifications |
| `{{ .NewEmail }}` | Change email address |
| `{{ .OldEmail }}` | Email address changed notification |
| `{{ .Phone }}`, `{{ .OldPhone }}` | Phone number changed notification |
| `{{ .Provider }}` | Sign-in method linked / removed |
| `{{ .FactorType }}` | MFA method added / removed |

Full reference: [Supabase email templates docs](https://supabase.com/docs/guides/auth/auth-email-templates).

## Notes

### Magic link vs OTP

[`magic-link.html`](./magic-link.html) includes both a **magic link button** and a **`{{ .Token }}`** code block. Use this for the **Magic link** template. If your provider prefetches links (Microsoft Safe Links), users can sign in with the OTP via `supabase.auth.verifyOtp`.

### Reset password OTP

[`reset-password.html`](./reset-password.html) also shows `{{ .Token }}` if you enable email OTP for recovery in **Auth → Providers → Email**.

### Reauthentication subject

Supabase allows the subject to include `{{ .Token }}` (see [docs example](https://supabase.com/docs/guides/auth/auth-email-templates)). The suggested subject above matches that pattern.

### Email prefetching

If confirmation links expire before users click them, prefer OTP (`{{ .Token }}`) or a custom confirm page — see Supabase **Email prefetching** section in the docs linked above.

## Theme reference

Matches public/marketing **light** tokens from `frontend/src/styles/themes/proplytic.tokens.css`:

- Background: `#f1f5f9`
- Card: `#ffffff`, border `#e2e8f0`
- Text: `#0f172a` / `#475569` / `#94a3b8`
- Primary button: `#7c3aed` (pill CTA)
