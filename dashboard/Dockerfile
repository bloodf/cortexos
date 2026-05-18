# syntax=docker/dockerfile:1.7
# Cortex Dashboard — multi-stage build.
#   deps    : install npm deps with cache-friendly layer
#   builder : Next.js standalone build + esbuild custom server
#   runtime : node:22-slim, non-root (uid=1000 `node`), dumb-init as PID 1
#
# Built on the VPS via `stacks/cortex-dashboard/docker-compose.yml`. No
# laptop-side build, no rsync.

############################
# Stage 1 — deps
############################
FROM node:22-slim AS deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# include devDependencies for the build stage; runtime stage drops them.
RUN npm ci --include=dev

############################
# Stage 2 — builder
############################
FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

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
    --outfile=.next/standalone/server.js

# Standalone does not copy public/, static/, messages/, or next.config.ts —
# stage them next to server.js so the custom server picks them up.
RUN cp -r public .next/standalone/public 2>/dev/null || true \
 && mkdir -p .next/standalone/.next \
 && cp -r .next/static .next/standalone/.next/static \
 && cp -r messages .next/standalone/messages 2>/dev/null || true \
 && cp next.config.ts .next/standalone/next.config.ts

############################
# Stage 3 — runtime
############################
FROM node:22-slim AS runtime
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

# Standalone bundle ships its own minimal node_modules; only native deps
# (ssh2 + bcryptjs for admin scripts) are copied separately.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/migrations ./migrations
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Native deps not bundled by Next standalone.
COPY --from=builder --chown=node:node /app/node_modules/ssh2 ./node_modules/ssh2
COPY --from=builder --chown=node:node /app/node_modules/cpu-features ./node_modules/cpu-features
COPY --from=builder --chown=node:node /app/node_modules/nan ./node_modules/nan
COPY --from=builder --chown=node:node /app/node_modules/bcryptjs ./node_modules/bcryptjs

RUN chmod +x docker-entrypoint.sh \
 && (chmod +x scripts/*.sh 2>/dev/null || true) \
 && chown -R node:node /app

USER node
EXPOSE 3080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3080/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]
