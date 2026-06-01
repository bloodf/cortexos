# syntax=docker/dockerfile:1.7
# Cortex Dashboard — multi-stage build from repo-root context.
# Builds fully inside Docker from source; no host-prebuilt Next assets needed.

############################
# Stage 1 — builder
############################
FROM node:26-slim AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

COPY packages ./packages

RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 600000
RUN --mount=type=cache,target=/root/.npm \
    cd packages/cortex-audit && npm install --no-audit --no-fund
RUN --mount=type=cache,target=/root/.npm \
    cd packages/dashboard && npm install --no-audit --no-fund
# Replace npm's local file symlinks with real directories so Turbopack resolves
# the internal packages consistently inside Docker.
RUN rm -rf /repo/packages/dashboard/node_modules/@cortexos/audit \
 && mkdir -p /repo/packages/dashboard/node_modules/@cortexos/audit \
 && cp -a /repo/packages/cortex-audit/. /repo/packages/dashboard/node_modules/@cortexos/audit/

WORKDIR /repo/packages/dashboard
RUN npm run build:next
RUN npx esbuild server.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=cjs \
    --packages=external \
    --outfile=server.js

# Turbopack may externalize modules as <name>-<hash>. Generate generic shims.
RUN node - <<'EOF'
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const nextDir = path.join(root, '.next');
const aliases = new Map();
const aliasRe = /["']((?:@[^/"']+\/)?[^"'\/]+)-([a-f0-9]{8,})["']/g;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      const text = fs.readFileSync(full, 'utf8');
      for (const m of text.matchAll(aliasRe)) {
        const fullAlias = m[1];
        const base = fullAlias.replace(/-[a-f0-9]{8,}$/, '');
        if (!aliases.has(fullAlias)) aliases.set(fullAlias, base);
      }
    }
  }
}
walk(nextDir);
for (const [aliasName, base] of aliases.entries()) {
  const dir = path.join(root, 'node_modules', aliasName);
  const target = base === 'pg' ? 'pg/lib/index.js' : base;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: aliasName, main: 'index.js' }, null, 2));
  fs.writeFileSync(path.join(dir, 'index.js'), `module.exports = require(${JSON.stringify(target)});\n`);
}
console.log(`created ${aliases.size} external-module shim(s)`);
EOF

############################
# Stage 2 — runtime
############################
FROM node:26-slim AS runtime
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

COPY --chown=node:node --from=builder /repo/packages/dashboard/package.json ./package.json
COPY --chown=node:node --from=builder /repo/packages/dashboard/node_modules ./node_modules
COPY --chown=node:node --from=builder /repo/packages/dashboard/.next ./.next
COPY --chown=node:node --from=builder /repo/packages/dashboard/public ./public
COPY --chown=node:node --from=builder /repo/packages/dashboard/messages ./messages
COPY --chown=node:node --from=builder /repo/packages/dashboard/migrations ./migrations
COPY --chown=node:node --from=builder /repo/packages/dashboard/scripts ./scripts
COPY --chown=node:node --from=builder /repo/packages/dashboard/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --chown=node:node --from=builder /repo/packages/dashboard/server.js ./server.js
COPY --chown=node:node --from=builder /repo/packages/dashboard/next.config.ts ./next.config.ts

RUN printf '%s\n' "module.exports = require('./lib/index.js');" > /app/node_modules/pg/index.js \
 && chmod +x docker-entrypoint.sh \
 && (chmod +x scripts/*.sh 2>/dev/null || true)

USER node
EXPOSE 3080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3080/en/login || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]
