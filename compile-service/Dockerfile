# compile-service/Dockerfile — Tectonic sandbox, non-root.
FROM node:20-slim

# Cài Tectonic + CA certs để tải bundle CTAN.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -sL https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-gnu.tar.gz \
    | tar -xz -C /usr/local/bin \
 && chmod +x /usr/local/bin/tectonic \
 && apt-get purge -y curl && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

# User non-root.
RUN useradd --create-home appuser
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .

ENV PORT=8080 \
    WORK_DIR=/tmp/compile \
    TECTONIC_CACHE_DIR=/var/cache/tectonic \
    COMPILE_TIMEOUT_MS=45000 \
    MAX_LATEX_BYTES=1000000

RUN mkdir -p /tmp/compile /var/cache/tectonic \
 && chown -R appuser:appuser /app /tmp/compile /var/cache/tectonic

USER appuser
EXPOSE 8080
CMD ["node", "server.js"]
