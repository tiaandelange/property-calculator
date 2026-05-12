# Cloudflare setup deep-dive

The high-level steps live in [`../DEPLOYMENT.md` § Step 5](../DEPLOYMENT.md#step-5--dns--cloudflare).
This page explains _why_ each Cloudflare setting matters and what it does
to a malicious request before it ever reaches Render.

## Mental model

```
malicious request ─► Cloudflare edge ─┬─► absorbed (WAF / DDoS / bot)
                                       │
                                       ├─► challenged (Turnstile / Captcha)
                                       │
                                       └─► forwarded to origin (Render)
```

Cloudflare's job is to **never let bad traffic reach your origin**. Render
charges by request volume + active CPU; if a 100k req/s reflection attack
hits your `*.onrender.com`, that's a real bill. Behind Cloudflare proxy,
the same attack mostly gets absorbed at the edge for free.

## DNS-only (grey cloud) vs Proxied (orange cloud)

Two record types matter:

| Subdomain          | Cloud colour    | Why                                                                                          |
| ------------------ | --------------- | -------------------------------------------------------------------------------------------- |
| `app.example.com`  | **Grey (DNS-only)** | Vercel handles its own TLS, edge caching, and DDoS. Proxying through Cloudflare often conflicts with Vercel's cert rotation. |
| `api.example.com`  | **Orange (proxied)** | Render's free tier has no DDoS protection. Cloudflare in front gives you WAF + DDoS + rate limit + caching. |
| `www.example.com`  | optional        | Either redirect to `app.` via a Cloudflare Page Rule, or alias to Vercel.                    |

## SSL/TLS settings

`SSL/TLS → Overview → SSL/TLS encryption mode`:

| Mode               | What it does                                                       | Use? |
| ------------------ | ------------------------------------------------------------------ | ---- |
| Off                | HTTP everywhere. Don't.                                            | ❌    |
| Flexible           | Browser↔Cloudflare HTTPS, Cloudflare↔origin **HTTP**. Insecure.    | ❌    |
| Full               | HTTPS both legs, but accepts any cert (including self-signed).     | ⚠️   |
| **Full (strict)**  | HTTPS both legs, validates origin cert against a public CA.        | ✅    |

Render automatically issues a Let's Encrypt cert for your custom domain
once DNS resolves, so **Full (strict)** works out of the box. Use it.

### HSTS

`SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS)`:

- **Enable HSTS**: yes
- **Max-age**: 6 months (`15552000` s) to start; bump to 1 year once you're
  confident
- **Apply HSTS policy to subdomains**: yes (only if you're not running any
  plain-HTTP subdomain anywhere)
- **Preload**: enable only when you're certain you'll never need to serve
  HTTP again — once you're on the preload list, browsers refuse to load
  your domain over HTTP **forever**, even after you remove HSTS.

The backend's Helmet middleware also sets HSTS, but Cloudflare's edge
header is what hits the browser first.

### Minimum TLS Version

`SSL/TLS → Edge Certificates → Minimum TLS Version` → **TLS 1.2**.

TLS 1.0 and 1.1 are deprecated and have published downgrade attacks. There
is no compatibility cost in 2026 — every supported browser does 1.2+.

## Security tab

`Security → Settings`:

| Setting             | Value          | Why                                                              |
| ------------------- | -------------- | ---------------------------------------------------------------- |
| Security Level      | **Medium**     | Cloudflare's heuristic threat score threshold. Medium is a sane default; raise to **High** if you're getting credential-stuffing waves. |
| Challenge Passage   | 30 min         | How long a passed Turnstile / Captcha is valid.                  |
| Browser Integrity Check | **On**     | Blocks known-bad User-Agents (mass scanners, vuln tools).         |

`Security → Bots → Bot Fight Mode` → **On**. Free tier. Blocks "definitely
bots" (Selenium, headless Chrome with bot fingerprint, etc.).

## WAF (Web Application Firewall)

Free tier: **Managed Rules** are enabled by default. They cover OWASP top
10, Cloudflare-curated rules, and "Free Managed Ruleset".

Useful **custom rules** (Rules → WAF → Custom rules) you can add for free:

```
# Block any non-GET on the static SPA host
(http.host eq "app.yourdomain.com" and http.request.method ne "GET")
→ Block

# Challenge /api/auth/register from datacenter ASNs (cuts out spam signups)
(http.host eq "api.yourdomain.com" and http.request.uri.path eq "/api/auth/register" and ip.geoip.is_in_european_union ne true and cf.threat_score gt 10)
→ Managed Challenge
```

(Tailor both to your own traffic.)

## Rate limiting at the edge

The backend already has `express-rate-limit` per-route, but those run on
your container's CPU. Cloudflare's free tier includes:

- **10,000 rate-limiting requests per month** at the edge.
- Up to **5 rules** on the free plan.

Useful rule:

```
URL path equals "/api/auth/login"
More than 20 requests per 1 minute per IP
Action: Block for 10 minutes
```

This protects the login endpoint without burning Render CPU.

## Page Rules / Cache Rules

For `api.yourdomain.com`, **disable cache** — the API returns user-specific
data and stripe webhooks. The default Cloudflare cache for non-static
content is "respect origin headers", and the backend already sets
`Cache-Control: no-store` for /api responses (via nginx config and now
Vercel headers).

If you want belt-and-braces:

```
api.yourdomain.com/*
Cache Level: Bypass
Disable Apps
Disable Performance
```

## What to check after you're done

```bash
# TLS cert chain
curl -I https://app.yourdomain.com 2>&1 | head -10
curl -I https://api.yourdomain.com/api/health

# HSTS header present
curl -sI https://app.yourdomain.com | grep -i strict-transport

# Bad request is rejected at the edge
curl -i 'https://api.yourdomain.com/.env'           # should be 4xx
curl -i 'https://api.yourdomain.com/api/admin/passwd'  # should be 401, not 5xx
```

Run [securityheaders.com](https://securityheaders.com/?q=https://app.yourdomain.com)
and [ssllabs.com/ssltest](https://www.ssllabs.com/ssltest/analyze.html?d=app.yourdomain.com)
once after going live and aim for an **A** on both. With the settings above
that should be automatic.
