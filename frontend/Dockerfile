FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
# npmワークスペース構成のためルートとfrontendのpackage.jsonをコピー
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# PostCSS等がfrontend内からモジュールを解決できるよう、frontend/node_modulesにもコピー
# builderステージのみで使用するためfinalイメージのサイズには影響しない
COPY --from=deps /app/node_modules ./frontend/node_modules
COPY package.json ./
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
