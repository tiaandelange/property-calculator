# syntax=docker/dockerfile:1.7
#
# Backend image. Multi-stage so that the final runtime image contains:
#   - production node_modules ONLY (no devDeps, no test/build tooling)
#   - the compiled `dist/` output (no .ts sources)
#   - the runtime shared libraries needed by pdfmake / chartjs-node-canvas
#   - a non-root user that owns /app
#   - tini as PID 1 for clean signal handling
#
# Intermediate stages contain the toolchains and dev dependencies; they are
# discarded by Docker once the final stage has copied the bits it needs.
#
# Build:        docker build -f backend/Dockerfile -t propertyguy-backend .
# Build context: repository root (so .dockerignore at the root applies).

# =============================================================================
# Stage 1 — builder
# =============================================================================
# Debian slim because chartjs-node-canvas pulls in native `canvas` whose Alpine
# musl prebuilds are unreliable. Cairo/Pango/JPEG/GIF/RSVG dev headers are
# needed at install-time and gcc/python3 are needed by node-gyp for any package
# that has no prebuild for this platform.
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      pkg-config \
      libcairo2-dev \
      libpango1.0-dev \
      libjpeg-dev \
      libgif-dev \
      librsvg2-dev \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install dependencies from the lockfile only. `npm ci` is significantly
# stricter than `npm install`:
#   - it fails the build if package-lock.json is missing or has drifted from
#     package.json (so a "minor" lockfile bump cannot ship unreviewed);
#   - it wipes node_modules first, so the build cannot be poisoned by a stale
#     local install on the host;
#   - it never writes to package-lock.json.
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci --no-audit --no-fund

# Now bring in the source and compile.
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
COPY backend/scripts ./scripts

RUN npx prisma generate \
 && npm run build

# After compilation, strip dev dependencies so we can copy a clean
# `node_modules` forward to the runtime stage. This is a defence-in-depth step
# in case the runtime stage's `npm ci --omit=dev` ever drifts.
RUN npm prune --omit=dev


# =============================================================================
# Stage 2 — runtime
# =============================================================================
# Same OS family as the builder so the native canvas .node binary that was
# linked against Debian's libcairo etc. continues to find the runtime SOs.
FROM node:20-bookworm-slim AS runner

# Install ONLY the shared libraries needed at runtime — no compilers, no dev
# headers, no python. `tini` is a tiny init that reaps zombie processes and
# forwards SIGTERM cleanly to the Node process. `curl` is needed by the
# HEALTHCHECK directive at the bottom of this file.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libcairo2 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libjpeg62-turbo \
      libgif7 \
      librsvg2-2 \
      ca-certificates \
      tini \
      curl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

# Create a dedicated non-root user with a fixed UID/GID so file ownership is
# stable across rebuilds and bind/volume mounts. The user has no login shell.
RUN groupadd --system --gid 10001 nodeapp \
 && useradd  --system --uid 10001 --gid nodeapp \
             --home /app --shell /usr/sbin/nologin nodeapp \
 && mkdir -p /app/reports /app/uploads /app/backups \
 && chown -R nodeapp:nodeapp /app

# Bring forward only the files needed to run the server. We intentionally do
# NOT copy `scripts/`, `tests/`, `src/`, `tsconfig.json`, `.env*`, jest config,
# or any other build/dev artefact.
COPY --from=builder --chown=nodeapp:nodeapp /app/package.json      ./package.json
COPY --from=builder --chown=nodeapp:nodeapp /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nodeapp:nodeapp /app/node_modules      ./node_modules
COPY --from=builder --chown=nodeapp:nodeapp /app/dist              ./dist
COPY --from=builder --chown=nodeapp:nodeapp /app/prisma            ./prisma

USER nodeapp

EXPOSE 4000

# Liveness probe. `/api/health` is an unauthenticated 200 OK and is mounted
# above the rate-limited /api/auth surface, so the loopback hits here will not
# pollute or trip the auth limiters. Curl exits non-zero on >=400 thanks to -f.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent --show-error http://127.0.0.1:4000/api/health \
      || exit 1

# tini ensures SIGTERM is delivered to Node and that orphan child processes
# (e.g. the chartjs canvas worker) get reaped, instead of accumulating as
# defunct entries inside the container.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
