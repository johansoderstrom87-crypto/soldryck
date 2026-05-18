FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ .
RUN npm run build

FROM base AS runner
WORKDIR /app
RUN apk add --no-cache su-exec
ENV NODE_ENV=production
ENV PORT=3000
ENV SHADOW_DATA_PATH=/app/shadow-data
ENV CLAIMED_DATA_PATH=/app/shadow-data

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs frontend/scripts/seed-shadow-data.mjs ./scripts/seed-shadow-data.mjs
COPY frontend/scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# Stay as root so entrypoint can chown the volume mount before dropping to nextjs
EXPOSE 3000
CMD ["./entrypoint.sh"]
