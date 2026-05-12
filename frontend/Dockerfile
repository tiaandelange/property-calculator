# syntax=docker/dockerfile:1.7
#
# Production frontend image. Multi-stage:
#   - builder: node:20-alpine compiles the SPA via `vite build`
#   - runner:  nginxinc/nginx-unprivileged serves the static bundle on :8080
#
# The runner image is the official "unprivileged" nginx variant — it runs as
# UID 101 with the master process *never* attempting to bind below port 1024.
# This means the container has no need for any root capability at runtime.
#
# Build context: repository root (so the root .dockerignore applies).

# =============================================================================
# Stage 1 — builder
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time configuration for the bundle. Sensible default for the typical
# deployment topology (nginx fronts both the SPA and the /api proxy):
#   VITE_API_BASE_URL=/api
# Override at build time if your topology differs:
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com/api ...
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Lockfile-only install; same rationale as the backend image. `--ignore-scripts`
# blocks any malicious package's `postinstall` hook from running during builds.
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts

COPY frontend .

RUN npm run build


# =============================================================================
# Stage 2 — runner
# =============================================================================
# nginxinc/nginx-unprivileged is maintained by the nginx team and is the
# upstream "rootless" variant. It already:
#   - runs the master process as UID 101 (nginx)
#   - listens on 8080 instead of 80 by default
#   - keeps logs on stdout/stderr
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

# Switch to root briefly just to drop in the SPA config + assets, then back to
# the unprivileged user before EXPOSE.
USER root

RUN rm -f /etc/nginx/conf.d/default.conf
COPY frontend/nginx.conf            /etc/nginx/conf.d/default.conf
COPY frontend/security-headers.conf /etc/nginx/conf.d/security-headers.conf

COPY --from=builder /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html

USER nginx

EXPOSE 8080

# Liveness probe — the SPA always serves index.html, but we add a dedicated
# /healthz to keep the probe path stable even if the SPA bundle ever 404s.
# wget is preinstalled (BusyBox) in the alpine base.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz \
      || exit 1

CMD ["nginx", "-g", "daemon off;"]
