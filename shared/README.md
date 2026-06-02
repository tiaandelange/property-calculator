# Shared packages

Pure TypeScript modules used by the Vite SPA and (via path alias) Vercel Functions.

## `calculatorShared/`

Deterministic property calculators (Zod validation, SA transfer/bond tables, IRR solver). Imported in the SPA as `@calculatorShared/*`.

Do not add Node-only or Express dependencies here.

## `propertyCalculator/`

Global property metrics and IRR engine (pure TypeScript). Canonical source lives here.

Vercel deploys with **Root Directory = `frontend`**. Before build, `npm run sync:property-calculator` copies
this folder to `frontend/api/lib/propertyCalculator` so report PDF API routes can import it inside the deploy root.

Edit formulas here, then run sync (or `npm run build`) so API report PDFs and the SPA stay aligned.
