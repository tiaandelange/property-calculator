# Secrets management

This is the **single source of truth** for what counts as a secret, where each
secret lives, how often to rotate it, and what to do when one leaks.

## The complete inventory

| Variable                  | Holder              | Class           | Where it lives                                          | Rotate cadence | Action on leak                                                                 |
| ------------------------- | ------------------- | --------------- | ------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`            | backend (Render)    | high            | Render env-var UI · Supabase Settings → Database        | quarterly      | Supabase → Settings → Database → Reset password → update Render                |
| `JWT_SECRET`              | backend (Render)    | high            | Render env-var UI (auto-generated)                      | quarterly      | Render → Environment → regenerate. **Logs out every user immediately.**        |
| `STRIPE_SECRET_KEY`       | backend (Render)    | high            | Render env-var UI · Stripe Dashboard → Developers       | yearly         | Stripe → Developers → API keys → Roll → update Render                          |
| `STRIPE_WEBHOOK_SECRET`   | backend (Render)    | medium          | Render env-var UI · Stripe Dashboard → Webhooks         | yearly         | Stripe → Webhooks → endpoint → Roll signing secret → update Render             |
| `SMTP_PASS`               | backend (Render)    | medium          | Render env-var UI · SMTP provider                       | quarterly      | SMTP provider → generate new credentials → update Render                       |
| Supabase database password | backend (Render)   | high            | Render env-var UI (encoded inside `DATABASE_URL`)       | quarterly      | See `DATABASE_URL`                                                             |
| Cloudflare API token       | ops                | high            | password manager · Cloudflare → My Profile → API Tokens | yearly         | Cloudflare → revoke token → mint new one                                       |
| Render API key             | ops                 | high            | password manager · Render → Account Settings → API Keys | yearly         | Render → revoke → mint new                                                     |
| Vercel personal token      | ops                 | high            | password manager · Vercel → Account → Tokens            | yearly         | Vercel → revoke → mint new                                                     |
| GitHub PAT (if used in CI) | ops                | high            | GitHub → Settings → Developer settings → PAT            | quarterly      | GitHub → revoke                                                                |

**Non-secrets** (safe to commit / paste publicly): `VITE_API_BASE_URL`,
`VITE_STRIPE_PUBLISHABLE_KEY`, `NODE_ENV`, `PORT`, `TRUST_PROXY`,
`JWT_EXPIRES_IN`, `FRONTEND_URL`, `FRONTEND_URLS`, `EMAIL_FROM`, `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`, `REPORTS_ROOT_OVERRIDE`.

> "high" = compromise gives an attacker full read/write access to user data
> or money. "medium" = compromise enables specific abuse (forge webhooks,
> send phishing mail). Treat both as private; the cadence differs.

## Where each secret is allowed to exist

```
┌──────────────────────────────────────────────────────────────────────────┐
│  source of truth: your password manager (1Password / Bitwarden / etc.)   │
└──────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼ deployment-time paste
┌──────────────────────────────────────────────────────────────────────────┐
│  Render / Railway env-var UI         (server-only secrets)               │
│  Vercel env-var UI                   (PUBLIC values only — see below)    │
│  Supabase dashboard                  (DB password)                       │
│  Stripe dashboard                    (Stripe keys + webhook signing key) │
│  Cloudflare dashboard                (API tokens)                        │
└──────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼ runtime read
┌──────────────────────────────────────────────────────────────────────────┐
│  Inside the running process: backend reads via `process.env.X`           │
│                              frontend reads ONLY `import.meta.env.VITE_*`│
└──────────────────────────────────────────────────────────────────────────┘
```

Secrets MUST NOT live in:

- Git history (run `gitleaks detect` before every push — see CI section)
- Slack / Email / Discord
- Pull-request descriptions or commit messages
- Application logs (the backend's logger redacts `Authorization` headers; do
  not log raw request bodies on auth or webhook routes)
- The Vite bundle (anything starting with `VITE_` is **inlined and public**)
- Docker images (build-time `ENV` directives bake the value into the image;
  always inject at runtime via the platform's secret manager)

## The "is this safe in `VITE_*`?" rule

> If you'd be comfortable posting the value on a public bug-tracker, it's
> safe to put in a `VITE_*` env var. If you wouldn't, **it cannot be a
> `VITE_*` env var, ever**.

Safe: API base URLs, Stripe **publishable** key (`pk_...`), Cloudflare
Turnstile site-key, Sentry DSN, Google Analytics ID.

Not safe: anything with `_SECRET`, `_KEY` (if it isn't a publishable key),
`PASSWORD`, `TOKEN`, or service-role keys. Service-role keys
(`SUPABASE_SERVICE_ROLE_KEY`, etc.) are **server-only** by definition — if
you're tempted to expose one to the browser, you're doing something wrong.

## Rotation cadence

Two flavours of rotation:

1. **Scheduled (proactive).** Per the table above — quarterly for high-class
   secrets, yearly for medium. Put a recurring calendar reminder on day 1
   of each quarter ("rotate JWT_SECRET, DATABASE_URL, SMTP_PASS"). This is
   not optional: the longer a secret exists, the higher the chance some
   forgotten log line, screenshot or stale CI artifact captured it.
2. **Triggered (reactive).** Within 1 hour of suspected exposure. Use the
   "Action on leak" column above. Then audit:
   - Was the secret used? Check Stripe API logs / Supabase auth logs /
     Render request logs for traffic from unexpected IPs around the
     exposure window.
   - Did anyone else have access? Slack threads, screen-share recordings,
     screenshot folders, browser histories on shared machines.

## Pre-commit secret-scanning

The cheapest way to never push a secret again: install
[gitleaks](https://github.com/gitleaks/gitleaks) and run it in a pre-commit
hook.

```bash
# one-time install (macOS shown; Linux: download binary from releases)
brew install gitleaks

# pre-commit hook (copy into .git/hooks/pre-commit and chmod +x)
#!/usr/bin/env bash
gitleaks protect --staged --redact --no-banner || {
  echo
  echo "✗ gitleaks found something that looks like a secret in your staged changes."
  echo "  Review the lines above. If it's a false positive, add a 'gitleaks:allow' comment."
  echo "  If it's a real secret, REMOVE it from the change AND rotate the value at the provider."
  exit 1
}
```

This adds ~200 ms to each commit and has caught us before on at least
`STRIPE_SECRET_KEY` and AWS access key leaks.

## CI/CD secret pattern (GitHub Actions)

The repo does not currently ship a CI workflow, but when it does, the
secret pattern looks like this:

```yaml
# .github/workflows/ci.yml  (illustrative — not yet present in the repo)
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      # Backend tests need a JWT_SECRET to sign tokens. We DON'T reuse the
      # production secret — each CI run mints a per-job random value.
      - name: Generate ephemeral test secrets
        run: |
          echo "JWT_SECRET=$(node -e 'console.log(require("crypto").randomBytes(48).toString("hex"))')" >> $GITHUB_ENV

      # Real secrets (production keys) go in GitHub → Settings → Secrets →
      # Actions, and are referenced like `${{ secrets.STRIPE_SECRET_KEY }}`.
      # ONLY pull them in for jobs that actually need them.
      - name: Run integration tests
        run: |
          cd backend && npm ci && npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STAGING_STRIPE_WEBHOOK_SECRET }}
```

GitHub Actions secret rules:

- Secrets are write-only after they're set — even repo admins can't read them
  back through the UI. Treat the password manager as the source of truth.
- Repository secrets are leaked to every workflow run by default. For
  high-class secrets, use **Environment secrets** with required reviewers.
- A `pull_request` workflow triggered from a fork **cannot read repository
  secrets** — this is the default and you should not weaken it.
- A logged value can be masked by `echo "::add-mask::$SECRET"` but
  preferred is "never let it into a logged context to begin with" (always
  reference via `${{ secrets.X }}` env injection, never via `with:` or
  `run:` substitution).

## Quarterly secret-hygiene checklist

Print this. Tick it off every three months.

- [ ] `JWT_SECRET` rotated (Render auto-generate, then redeploy)
- [ ] Supabase database password rotated; `DATABASE_URL` updated in Render
- [ ] `SMTP_PASS` rotated at SMTP provider; updated in Render
- [ ] `git log --all --since=3.months.ago -p` skimmed for accidental secret
      commits; if any, rotate immediately
- [ ] `gitleaks detect --redact` run against full history; if any finding,
      rotate
- [ ] Stripe API logs scanned for requests from unrecognised IPs
- [ ] Render/Vercel access logs scanned for unfamiliar deploy events
- [ ] List of people with access to the GitHub repo / Render / Vercel /
      Cloudflare / Supabase / Stripe / SMTP provider audited; ex-collaborators
      removed
- [ ] Password manager: secrets table in this doc matches reality
