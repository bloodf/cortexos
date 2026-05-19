# syntax=docker/dockerfile:1.7
# Cortex Dashboard — multi-stage build.
# Build context is the repo root so local packages resolve without publishing.

############################
# Stage 1 — deps
############################
FROM node:22-slim AS deps
WORKDIR /repo
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY stacks/cortex-paperclip-bridge/package.json ./stacks/cortex-paperclip-bridge/package.json
COPY stacks/cortex-consumer/package.json ./stacks/cortex-consumer/package.json
COPY stacks/cortex-agentgateway/package.json ./stacks/cortex-agentgateway/package.json
# Use pnpm with workspace protocol — npm cannot resolve "workspace:*".
RUN pnpm install --frozen-lockfile --filter @cortexos/dashboard...

############################
# Stage 2 — builder
############################
FROM node:22-slim AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages ./packages
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
WORKDIR /repo/packages/cortex-dashboard
RUN pnpm exec next build --turbopack
RUN pnpm exec esbuild server.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=cjs \
    --packages=external \
    --outfile=.next/standalone/packages/cortex-dashboard/server.js
RUN cp -r public .next/standalone/packages/cortex-dashboard/public 2>/dev/null || true \
 && mkdir -p .next/standalone/packages/cortex-dashboard/.next \
 && cp -r .next/static .next/standalone/packages/cortex-dashboard/.next/static \
 && cp -r messages .next/standalone/packages/cortex-dashboard/messages 2>/dev/null || true \
 && cp next.config.ts .next/standalone/packages/cortex-dashboard/next.config.ts

############################
# Stage 3 — runtime
############################
FROM node:22-slim AS runtime
WORKDIR /app
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
 && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /repo/packages/cortex-dashboard/.next/standalone/packages/cortex-dashboard ./
COPY --from=builder --chown=node:node /repo/packages/cortex-dashboard/.next/standalone/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/packages/cortex-dashboard/migrations ./migrations
COPY --from=builder --chown=node:node /repo/packages/cortex-dashboard/scripts ./scripts
COPY --from=builder --chown=node:node /repo/packages/cortex-dashboard/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder --chown=node:node /repo/packages/cortex-dashboard/node_modules/ssh2 ./node_modules/ssh2
COPY --from=builder --chown=node:node /repo/packages/cortex-dashboard/node_modules/bcryptjs ./node_modules/bcryptjs
RUN chmod +x docker-entrypoint.sh \
 && (chmod +x scripts/*.sh 2>/dev/null || true) \
 && chown -R node:node /app
USER node
EXPOSE 3080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3080/api/health || exit 1
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]
