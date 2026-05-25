# Shared packages

Pure TypeScript modules used by the Vite SPA and (via path alias) Vercel Functions.

## `calculatorShared/`

Deterministic property calculators (Zod validation, SA transfer/bond tables, IRR solver). Imported in the SPA as `@calculatorShared/*`.

Do not add Node-only or Express dependencies here.
