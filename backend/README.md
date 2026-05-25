# Legacy tools (`backend/`)

This directory is **not** a production API server. Express was retired; the live stack is **Vercel + Supabase**.

## What remains

| Path | Purpose |
|------|---------|
| `prisma/` | Historical schema for one-off migration scripts |
| `scripts/legacy-prisma-migration/` | Export/reset/cleanup utilities against old Prisma DB |
| `scripts/verify-public-frontend-env.mjs` | Ensures no service-role or Stripe secrets in `frontend/src` |
| `tests/unit/` | Unit tests for `shared/calculatorShared/` |
| `archive/express-retired/` | Pointer to retired Express runtime |

## Scripts

```bash
cd backend
npm ci
npm run verify:public-env
npm test                    # calculator shared library tests
npm run reset:portfolio-data   # local dev only — requires DATABASE_URL
```

Set `DATABASE_URL` only when running legacy Prisma scripts. Production does not use Prisma.
