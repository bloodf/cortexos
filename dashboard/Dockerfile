FROM node:24-bookworm-slim AS base

FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx next build --webpack
RUN npx esbuild server.ts --bundle --platform=node --packages=external --outfile=server.compiled.js

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
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/server.compiled.js ./server.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY migrations ./migrations
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3080

ENTRYPOINT ["./docker-entrypoint.sh"]
