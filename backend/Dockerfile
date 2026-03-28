FROM node:20-alpine AS builder
WORKDIR /app
# npmワークスペース構成のためルートとbackendのpackage.jsonをコピー
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci
COPY backend/ ./backend/
RUN npm run build --workspace=backend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# ルートのnode_modulesをそのままコピー（typeorm等のCLIもここに含まれる）
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./
EXPOSE 3003
CMD ["node", "dist/main"]
