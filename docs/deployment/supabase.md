# Supabase setup deep-dive

The high-level steps live in [`../DEPLOYMENT.md` § Step 1](../DEPLOYMENT.md#step-1--provision-the-database-supabase).
This page covers the parts that bite you only once you're past the happy path.

## Connection string variants

Supabase exposes the same Postgres on three URLs. Pick the right one:

| Mode               | Port  | Use case                                                                                                                |
| ------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| **Direct**         | 5432  | A long-lived process you control (e.g. running `prisma migrate deploy` from your laptop). Supports prepared statements. |
| **Session pooler** | 5432  | Same shape as direct, but proxied via pgbouncer in session mode.                                                        |
| **Transaction pooler** | 6543 | Recommended for Render/Railway/serverless. Pool managed by Supabase; you don't burn one slot per container.        |

For The Property Guy backend on Render, use **Transaction pooler** (port 6543).

If you ever migrate to a serverless function runtime (Vercel functions,
Cloudflare Workers), append `?pgbouncer=true&connection_limit=1` so Prisma
doesn't try to open more sockets than the pool allows.

## Migrations

The repo uses **Prisma Migrate**. The production-safe command is:

```bash
DATABASE_URL="<your prod URI>" npx prisma migrate deploy
```

- `migrate deploy` applies any pending migrations and exits. It never
  generates new files.
- `migrate dev` does generate new files and is for local development only.
  **Never** run it against the production DB.

You run `migrate deploy` whenever you push a new migration. Two options:

1. **Manually after each release:** simpler, fine for early days. Run the
   command from your laptop with the prod `DATABASE_URL`.
2. **Automated in CI:** add a GitHub Actions job that runs `migrate deploy`
   after the Render deploy goes green. The Render dashboard has a "Pre-Deploy
   Command" field on paid plans that can run it for you.

## Backups

Free tier: Supabase keeps **daily** backups for 7 days. They're restorable
through the dashboard, no action needed on your side.

If you need point-in-time recovery, you're on a paid plan.

## Security checklist

- **Database password:** generated at project creation, store in a password
  manager. Reset via Settings → Database → Reset password if it ever leaks.
- **Connection string contains the password.** Treat the whole URL as a
  secret. Never commit it. Never paste it into PR descriptions or chat.
- **Network restrictions:** Supabase exposes Postgres to the public internet
  but lets you allow-list IPs at Settings → Database → Network Restrictions.
  Render's egress IPs aren't static on the free plan, so leave this open by
  default and rely on the password.
- **Row Level Security:** the schema doesn't use RLS today because the
  application enforces ownership in code (`where: { id, userId }`). If you
  ever migrate to Supabase Auth and start letting clients talk to Postgres
  directly (e.g. via PostgREST), you **must** enable RLS first.

## Common errors

### `error: Tenant or user not found`

You forgot to **replace `[YOUR-PASSWORD]`** in the connection string. Open
Settings → Database → Reset database password, replace it, and try again.

### `error: prepared statement "s0" already exists`

You're using the transaction pooler (port 6543) with a Prisma version older
than 5.10. Either upgrade Prisma or switch to the direct connection (5432).
We're on `@prisma/client ^5.22.0` so this should not happen.

### `error: server certificate verification failed`

You dropped `sslmode=require` from the connection string. Add it back.
