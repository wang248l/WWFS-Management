# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
# Use install (not ci) so first-time deploys work without a checked-in lockfile.
RUN npm install --no-audit --no-fund --prefer-offline

# ---- builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && npx prisma generate && npm run build

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
# On startup: sync schema to /data/management.db, seed dept/metric definitions
# (idempotent), then start Next.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && (npx tsx prisma/seed.ts || true) && npm start"]
