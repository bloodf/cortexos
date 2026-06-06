# syntax=docker/dockerfile:1.7
# Cortex Dashboard — SvelteKit adapter-node multi-stage build.
# Builds fully inside Docker from source; no host-prebuilt assets needed.

############################
# Stage 1 — builder
############################
FROM node:22-slim AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./
COPY packages/dashboard ./packages/dashboard
COPY packages/dashboard/.npmrc ./packages/dashboard/.npmrc
COPY packages/contracts ./packages/contracts

# Install pnpm and build dependencies
RUN npm install -g pnpm@10.12.1 \
 && pnpm config set fetch-retries 5 \
 && pnpm config set fetch-retry-mintimeout 20000 \
 && pnpm config set fetch-retry-maxtimeout 120000 \
 && pnpm config set fetch-timeout 600000 \
 && apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpam0g-dev python3 \
 && rm -rf /var/lib/apt/lists/*

# Install workspace deps (frozen lockfile if present)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

# Build shared contracts package first (required by dashboard)
RUN pnpm --filter @cortexos/contracts build

# Build the SvelteKit app (adapter-node outputs build/index.js)
RUN cd packages/dashboard && pnpm build

############################
# Stage 2 — runtime
############################
FROM node:22-slim AS runtime
WORKDIR /repo/packages/dashboard
ENV NODE_ENV=production \
    PORT=3080 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      dumb-init \
      curl \
      ca-certificates \
      postgresql-client \
      libpam0g-dev \
 && rm -rf /var/lib/apt/lists/*

# Copy the full monorepo so pnpm symlinks remain valid
COPY --chown=node:node --from=builder /repo/packages/dashboard/package.json ./package.json
COPY --chown=node:node --from=builder /repo/packages/dashboard/node_modules ./node_modules
COPY --chown=node:node --from=builder /repo/node_modules/.pnpm ../../node_modules/.pnpm
COPY --chown=node:node --from=builder /repo/packages/dashboard/build ./build
COPY --chown=node:node --from=builder /repo/packages/dashboard/static ./static
COPY --chown=node:node --from=builder /repo/packages/dashboard/migrations ./migrations
COPY --chown=node:node --from=builder /repo/packages/dashboard/scripts ./scripts

# Create entrypoint script
COPY --chown=node:node <<'EOF' /repo/packages/dashboard/docker-entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail

# Run database migrations if DB_PASSWORD is provided
if [ -n "${DB_PASSWORD:-}" ]; then
    echo "==> Running database migrations..."
    node scripts/migrate-cli.js
fi

echo "==> Starting Cortex Dashboard on ${HOSTNAME:-0.0.0.0}:${PORT:-3080}"
exec node build/index.js
EOF

RUN chmod +x /repo/packages/dashboard/docker-entrypoint.sh \
 && chmod +x scripts/migrate-cli.js \
 && (chmod +x scripts/*.sh 2>/dev/null || true)

USER node
EXPOSE 3080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3080/login || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]
