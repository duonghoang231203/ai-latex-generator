# Dockerfile — Next.js app (BFF). Multi-stage, non-root.
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

FROM node:20-slim AS builder
WORKDIR /app
# NEXT_PUBLIC_* phải là env lúc build để Next inline vào bundle client.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
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
# Thư mục lưu tài liệu (file-based) + cache model OCR — cần ghi được bởi non-root appuser.
# Mount named volume vào các thư mục này (docker-compose) để giữ dữ liệu qua restart.
RUN mkdir -p /data /var/cache/tesseract \
 && chown -R appuser:appuser /data /var/cache/tesseract
ENV DATA_DIR=/data \
    TESSERACT_CACHE_DIR=/var/cache/tesseract
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# OCR/trích xuất: các gói external (serverExternalPackages) + asset wasm/worker có thể bị
# bỏ sót khi Next trace standalone → copy tường minh để chắc chắn chạy được lúc runtime.
COPY --from=builder /app/node_modules/tesseract.js ./node_modules/tesseract.js
COPY --from=builder /app/node_modules/tesseract.js-core ./node_modules/tesseract.js-core
COPY --from=builder /app/node_modules/pdf-parse ./node_modules/pdf-parse
COPY --from=builder /app/node_modules/mammoth ./node_modules/mammoth
USER appuser
EXPOSE 3000
CMD ["node", "server.js"]
