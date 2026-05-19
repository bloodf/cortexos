FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY stacks/cortex-consumer ./stacks/cortex-consumer
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runtime
WORKDIR /repo/stacks/cortex-consumer
RUN addgroup -S cortex && adduser -S -G cortex cortex
COPY --from=deps /repo /repo
RUN chown -R cortex:cortex /repo
USER cortex
ENV NODE_ENV=production
CMD ["node", "consumer.js"]
