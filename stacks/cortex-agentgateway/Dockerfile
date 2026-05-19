# Multi-stage build for cortex-agentgateway.

FROM node:22-slim AS deps
WORKDIR /app
COPY packages/cortex-events ./packages/cortex-events
COPY packages/cortex-audit ./packages/cortex-audit
COPY packages/cortex-telemetry ./packages/cortex-telemetry
COPY stacks/cortex-agentgateway ./stacks/cortex-agentgateway
RUN cd packages/cortex-events && npm install --omit=dev --no-audit --no-fund
RUN cd packages/cortex-audit && npm install --omit=dev --no-audit --no-fund
RUN cd packages/cortex-telemetry && npm install --omit=dev --no-audit --no-fund
RUN cd stacks/cortex-agentgateway && npm install --omit=dev --no-audit --no-fund

FROM node:22-slim AS runtime
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system cortex \
 && useradd --system --gid cortex --home /app --shell /usr/sbin/nologin cortex
COPY --from=deps /app/packages/cortex-events ./packages/cortex-events
COPY --from=deps /app/packages/cortex-audit ./packages/cortex-audit
COPY --from=deps /app/packages/cortex-telemetry ./packages/cortex-telemetry
COPY --from=deps /app/stacks/cortex-agentgateway/node_modules ./stacks/cortex-agentgateway/node_modules
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
