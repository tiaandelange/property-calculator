# Contact form — manual verification

Run after deploying contact API + page and applying `supabase/migrations/20260612120000_contact_submissions.sql`.

## Vercel env (server only)

- `RESEND_API_KEY`
- `CONTACT_FROM_EMAIL` (verified Resend sender)
- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

Optional: `CONTACT_TO_EMAIL` (defaults to `delangetiaanoffice@gmail.com`).

## UI (signed out)

1. Open `/contact` — marketing header + footer, no dashboard sidebar.
2. Footer **Contact** → `/contact`.
3. Submit empty form → validation errors.
4. Email `not-an-email` → rejected.
5. Resize to 360px width → single column, no horizontal scroll.

## API

```bash
# Honeypot — expect 200 { "ok": true }, no DB row
curl -X POST https://<your-domain>/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Bot","email":"bot@test.com","subject":"x","message":"x","website":"http://spam.test"}'

# Valid — expect 200 { "ok": true, "id": "..." }
curl -X POST https://<your-domain>/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"you@example.com","phone":"+27000000000","subject":"E2E test","message":"Automated check"}'
```

## Supabase

```sql
SELECT id, name, email, phone, subject, message, source, created_at
FROM public.contact_submissions
ORDER BY created_at DESC
LIMIT 5;
```

## Email

- Inbox: `delangetiaanoffice@gmail.com` (unless `CONTACT_TO_EMAIL` set).
- Subject: `New Proplytic contact form submission: …`
- Body includes name, email, phone, subject, message.
- **Reply-To** should be the submitter’s email.

## Secrets (browser)

DevTools → Sources / search built bundle for `RESEND_API_KEY`, `service_role` — must not appear.
