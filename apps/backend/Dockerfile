FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN npm ci
COPY apps/backend/ .
RUN npm run build

# --- migration runner ---
FROM node:20-alpine AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
# DATABASE_URL は ECS secrets: フィールドで環境変数として注入される
COPY apps/backend/scripts/run-migration.sh ./
RUN chmod +x run-migration.sh
CMD ["sh", "run-migration.sh"]

# --- app runner ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
EXPOSE 3003
CMD ["node", "dist/main"]
