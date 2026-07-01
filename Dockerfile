# Dockerfile — Next.js app (BFF). Multi-stage, non-root.
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Bind mọi interface để cổng publish của Docker tới được (Next standalone).
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN useradd --create-home appuser
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER appuser
EXPOSE 3000
CMD ["node", "server.js"]
