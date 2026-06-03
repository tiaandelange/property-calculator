# Supabase Auth email templates (Proplytic)

HTML sources for **Supabase Dashboard → Authentication → Email Templates**.  
These are not applied by migrations — paste each file into the matching template in the dashboard.

## Confirm signup

| Field | Value |
| ----- | ----- |
| **Template** | Confirm signup |
| **Subject (suggested)** | `Confirm your Proplytic email` |
| **Body** | Copy all of [`confirm-signup.html`](./confirm-signup.html) |

### Variables used

- `{{ .ConfirmationURL }}` — confirmation link (required)
- `{{ .SiteURL }}` — project Site URL (logo + home link)

Ensure **Authentication → URL configuration → Site URL** matches your app origin (e.g. `https://proplytic.co.za`) so the logo path `/proplytic_logo_600x200_nobg.png` resolves.

### Redirect URLs

Include your confirm route in **Redirect URLs**, for example:

- `https://<your-domain>/confirm-email`
- `http://localhost:5173/confirm-email` (local dev)

## Theme reference

Matches public/marketing **light** tokens from `frontend/src/styles/themes/proplytic.tokens.css`:

- Background: `#f1f5f9`
- Card: `#ffffff`, border `#e2e8f0`
- Text: `#0f172a` / `#475569` / `#94a3b8`
- Primary button: `#7c3aed` (pill CTA)
