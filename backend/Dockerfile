# syntax=docker/dockerfile:1.7
#
# Slim backend: health + Stripe webhook (Supabase is system of record).
# Build context: repository root.

FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY backend/tsconfig*.json ./
COPY backend/src ./src

RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runner

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini curl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

RUN groupadd --system --gid 10001 nodeapp \
 && useradd --system --uid 10001 --gid nodeapp --home /app --shell /usr/sbin/nologin nodeapp \
 && chown -R nodeapp:nodeapp /app

COPY --from=builder --chown=nodeapp:nodeapp /app/package.json ./package.json
COPY --from=builder --chown=nodeapp:nodeapp /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nodeapp:nodeapp /app/node_modules ./node_modules
COPY --from=builder --chown=nodeapp:nodeapp /app/dist ./dist

USER nodeapp

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:4000/api/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
