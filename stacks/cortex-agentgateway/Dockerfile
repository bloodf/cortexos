# Multi-stage build for cortex-agentgateway.
# Build context MUST be the monorepo root so workspace packages
# (packages/cortex-*) can be copied into the image.

FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate

# Workspace manifest + lockfile + workspace package manifests are enough to
# resolve and install the gateway's dependency closure deterministically.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/cortex-events/package.json packages/cortex-events/package.json
COPY packages/cortex-audit/package.json packages/cortex-audit/package.json
COPY packages/cortex-telemetry/package.json packages/cortex-telemetry/package.json
COPY packages/paperclip-adapter/package.json packages/paperclip-adapter/package.json
COPY stacks/cortex-agentgateway/package.json stacks/cortex-agentgateway/package.json
COPY stacks/cortex-paperclip-bridge/package.json stacks/cortex-paperclip-bridge/package.json
COPY stacks/cortex-consumer/package.json stacks/cortex-consumer/package.json

# Install agentgateway workspace deps (prod only).
RUN pnpm install --filter cortex-agentgateway... --prod --frozen-lockfile \
  || pnpm install --filter cortex-agentgateway... --prod

# -----------------------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system cortex \
 && useradd  --system --gid cortex --home /app --shell /usr/sbin/nologin cortex

# Workspace source + installed node_modules.
COPY --from=deps /app/stacks/cortex-agentgateway/node_modules ./stacks/cortex-agentgateway/node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY packages/cortex-events packages/cortex-events
COPY packages/cortex-audit packages/cortex-audit
COPY packages/cortex-telemetry packages/cortex-telemetry
COPY schemas schemas
COPY stacks/cortex-agentgateway/index.js stacks/cortex-agentgateway/index.js
COPY stacks/cortex-agentgateway/lib stacks/cortex-agentgateway/lib
COPY stacks/cortex-agentgateway/config stacks/cortex-agentgateway/config
COPY stacks/cortex-agentgateway/package.json stacks/cortex-agentgateway/package.json

RUN chown -R cortex:cortex /app

USER cortex
WORKDIR /app/stacks/cortex-agentgateway
EXPOSE 18800
ENV NODE_ENV=production \
    AGENTGATEWAY_PORT=18800

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "index.js"]
