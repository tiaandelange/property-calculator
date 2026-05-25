# Legacy Prisma migration scripts

**Not imported by the production API.** Use only for one-off data maintenance against a database that still has the old Prisma schema, or for historical reference during cutover.

Production runtime uses **Supabase Postgres** (`supabase/migrations/`) and the slim Express app in `backend/src/` (health + Stripe).

## Requirements

- `DATABASE_URL` pointing at the target Postgres (often the same Supabase project before full cutover)
- `npx prisma generate` from `backend/` (Prisma is a **devDependency**)
- Run with `tsx` or `node --loader ts-node/esm` as noted in each script

## Scripts

| Script | Purpose |
|--------|---------|
| `reset-portfolio-data.ts` | Destructive portfolio wipe (local dev only) |
| `export-portfolio-backup.ts` | JSON backup of Prisma-shaped rows |
| `confirm-admin.ts` | Legacy Prisma `User` admin confirmation |
| `cleanup-*.ts` | One-off ledger/tenant/lease cleanups |
| `prisma/seed.ts` | Legacy seed (superseded by Supabase `handle_new_user`) |

Do **not** add these to `npm run build` or the Docker image CMD.
