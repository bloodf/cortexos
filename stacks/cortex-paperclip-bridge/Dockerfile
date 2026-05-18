FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S cortex && adduser -S -G cortex cortex
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server.js worker.js entrypoint.sh ./
COPY lib ./lib
RUN chmod +x entrypoint.sh && chown -R cortex:cortex /app
USER cortex
EXPOSE 8089
ENV NODE_ENV=production
ENTRYPOINT ["/app/entrypoint.sh"]
