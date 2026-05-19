# syntax=docker/dockerfile:1.7
# Cortex Dashboard — multi-stage build (monorepo workspace aware).
#   deps    : install workspace deps from repo root
#   builder : Next.js standalone build + esbuild custom server
#   runtime : node:22-slim, non-root (uid=1000 `node`), dumb-init as PID 1
#
# Build context is the **repo root** (not dashboard/) so workspace
# packages under packages/* and stacks/* resolve. Built on the VPS via
# `stacks/cortex-dashboard/docker-compose.yml`.

############################
# Stage 1 — deps
############################
FROM node:26-slim AS deps
WORKDIR /repo
ENV NODE_ENV=production
COPY package.json ./
COPY packages ./packages
COPY stacks/cortex-paperclip-bridge/package.json ./stacks/cortex-paperclip-bridge/package.json
COPY stacks/cortex-consumer/package.json ./stacks/cortex-consumer/package.json
COPY dashboard/package.json ./dashboard/package.json
# include devDependencies for the build stage; runtime drops them.
# regen lockfile because the host lockfile (mac) doesn't reliably carry
# linux-x64-gnu optional bindings (npm/cli#4828).
RUN npm install --include=dev --include=optional --no-audit --no-fund

############################
# Stage 2 — builder
############################
FROM node:26-slim AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json /repo/package-lock.json ./
COPY packages ./packages
COPY dashboard ./dashboard

WORKDIR /repo/dashboard

# next build → emits .next/standalone (stock server) + .next/static.
RUN npx next build --turbopack

# Replace stock standalone server with our custom server (Socket.IO +
# retention loop + alert engine). Bundle as CJS with external native deps.
RUN npx esbuild server.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=cjs \
    --packages=external \
    --outfile=.next/standalone/dashboard/server.js

# Standalone places dashboard files under .next/standalone/dashboard/ in
# a workspace. Stage public/, static/, messages/, next.config alongside it.
RUN cp -r public .next/standalone/dashboard/public 2>/dev/null || true \
 && mkdir -p .next/standalone/dashboard/.next \
 && cp -r .next/static .next/standalone/dashboard/.next/static \
 && cp -r messages .next/standalone/dashboard/messages 2>/dev/null || true \
 && cp next.config.ts .next/standalone/dashboard/next.config.ts

############################
# Stage 3 — runtime
############################
FROM node:26-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3080 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Runtime deps:
#   dumb-init        — PID 1 signal forwarding + zombie reaping
#   curl             — healthcheck
#   postgresql-client — entrypoint waits on `psql`
#   ca-certificates  — TLS roots for outbound HTTPS
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      dumb-init \
      curl \
      ca-certificates \
      postgresql-client \
 && rm -rf /var/lib/apt/lists/*

# Copy the standalone bundle as the app root. Next places workspace apps
# at /repo/dashboard/.next/standalone/dashboard, with hoisted node_modules
# at /repo/dashboard/.next/standalone/node_modules.
COPY --from=builder --chown=node:node /repo/dashboard/.next/standalone/dashboard ./
COPY --from=builder --chown=node:node /repo/dashboard/.next/standalone/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/dashboard/migrations ./migrations
COPY --from=builder --chown=node:node /repo/dashboard/scripts ./scripts
COPY --from=builder --chown=node:node /repo/dashboard/docker-entrypoint.sh ./docker-entrypoint.sh

# Native deps not bundled by Next standalone (from hoisted root modules).
# cpu-features + nan are optional native deps of ssh2; if absent ssh2
# falls back to its pure-JS cipher, so we skip them.
COPY --from=builder --chown=node:node /repo/node_modules/ssh2 ./node_modules/ssh2
COPY --from=builder --chown=node:node /repo/node_modules/bcryptjs ./node_modules/bcryptjs

RUN chmod +x docker-entrypoint.sh \
 && (chmod +x scripts/*.sh 2>/dev/null || true) \
 && chown -R node:node /app

USER node
EXPOSE 3080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3080/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]
