# compile-service/Dockerfile — Tectonic sandbox, non-root.
FROM node:20-slim

# Cài Tectonic (binary tĩnh musl, chọn theo kiến trúc) + CA certs + fontconfig + font thay thế.
# fonts-liberation2 (Times/Arial-compatible) + fonts-texgyre giúp fontconfig alias các font
# Windows độc quyền (vd "Times New Roman") sang font sẵn có trên Linux.
ARG TARGETARCH
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl fontconfig fonts-liberation2 fonts-texgyre fonts-lmodern \
 && case "$TARGETARCH" in \
      amd64) TECT_ARCH=x86_64-unknown-linux-musl ;; \
      arm64) TECT_ARCH=aarch64-unknown-linux-musl ;; \
      *) echo "Kiến trúc không hỗ trợ: $TARGETARCH" && exit 1 ;; \
    esac \
 && curl -sL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-${TECT_ARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin \
 && chmod +x /usr/local/bin/tectonic \
 && apt-get purge -y curl && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/* \
 && fc-cache -f

# User non-root.
RUN useradd --create-home appuser
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .

ENV PORT=8080 \
    WORK_DIR=/tmp/compile \
    XDG_CACHE_HOME=/var/cache/tectonic \
    TECTONIC_CACHE_DIR=/var/cache/tectonic \
    COMPILE_TIMEOUT_MS=45000 \
    MAX_LATEX_BYTES=1000000

RUN mkdir -p /tmp/compile /var/cache/tectonic \
 && chown -R appuser:appuser /app /tmp/compile /var/cache/tectonic

USER appuser
EXPOSE 8080
CMD ["node", "server.js"]
