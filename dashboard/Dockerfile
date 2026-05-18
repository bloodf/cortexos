FROM node:24-bookworm-slim AS base

FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build Next.js with turbopack producing .next/standalone + .next/static.
RUN npx next build --turbopack
# Replace standalone's stock server with our custom server (Socket.IO + workers).
RUN npx esbuild server.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=cjs \
    --packages=external \
    --outfile=.next/standalone/server.js
# Standalone does not copy public/ or static/ — stage them next to server.js.
RUN cp -r public .next/standalone/public 2>/dev/null || true
RUN mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/static
RUN cp -r messages .next/standalone/messages 2>/dev/null || true
RUN cp next.config.ts .next/standalone/next.config.ts

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3080

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    util-linux \
    procps \
    iproute2 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Standalone bundle ships its own node_modules. No npm ci needed at runtime.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh scripts/*.sh 2>/dev/null || true

EXPOSE 3080

ENTRYPOINT ["./docker-entrypoint.sh"]
