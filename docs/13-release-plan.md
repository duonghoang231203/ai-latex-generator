# 13 — Release Plan (đưa dự án lên staging → production)

Tài liệu theo dõi việc **update và đẩy dần** dự án ra người dùng. Chiến lược xuyên suốt:
trunk-based + feature flag, mỗi phase kết thúc bằng **release tag** và deploy **staging → prod**.

> Checklist chi tiết các đầu việc **chưa làm** (Phase 0 phần Docker, Phase 1/2/3): xem
> [`14-phase-backlog.md`](./14-phase-backlog.md).

## Bối cảnh đánh giá
- Tính năng lõi đầy đủ: sinh (11 template) → AST validate → compile sandbox (Tectonic `--untrusted`)
  → repair loop → lưu trữ file-based → CRUD → chat-edit → upload/extract (PDF/DOCX) + OCR ảnh.
- Kiểm thử: unit + integration (Vitest) xanh; build/lint sạch.
- Rào cản publish public: **chưa có auth**, rate-limit in-memory/IP, chưa CI/CD, chưa LICENSE,
  lưu trữ single-node, thiếu observability, OCR/extract cần verify trong Docker.

---

## Phase 0 — Hardening tối thiểu để lên staging  ✅ (đang thực hiện)
Mục tiêu: đủ an toàn/quan sát được để chạy internal beta sau reverse proxy.

Hạng mục:
- [x] **CI** GitHub Actions (`.github/workflows/ci.yml`): lint + test + build (next-app),
      test (compile-service), build 2 Docker image.
- [x] **LICENSE** (MIT) — sửa chủ sở hữu/năm nếu cần.
- [x] **Healthcheck** `GET /api/health` (liveness) + `?deep=1` (ping compile-service);
      healthcheck cho cả 2 service trong `docker-compose.yml`.
- [x] **Logging có cấu trúc** (`lib/log.ts`, JSON, tự redact secret): log `document.create`,
      `document.chat_edit` (chỉ số liệu/nhãn, KHÔNG nội dung/khoá).
- [x] **Reverse proxy + TLS**: Caddy là điểm vào duy nhất; `next-app` không expose ra host;
      header bảo mật + giới hạn body 20MB (`Caddyfile`).
- [x] **OCR cache cấu hình được** (`TESSERACT_CACHE_DIR`) + volume `tesseract-cache`; thư mục
      ghi được cho non-root trong `Dockerfile`.

Exit criteria (cần môi trường có Docker để chốt):
- [ ] `docker compose build` thành công cả 3 service.
- [ ] `docker compose up` → `curl http://localhost/api/health?deep=1` trả `ok`
      (đặt `SITE_ADDRESS=<domain>` để bật TLS thật khi lên prod).
- [ ] **Verify OCR/extract trong Docker**: upload thử 1 PDF, 1 DOCX, 1 ảnh → có nội dung.
      Nếu OCR lỗi do standalone thiếu asset: đã copy tường minh `tesseract.js*`/`pdf-parse`/`mammoth`
      trong `Dockerfile`; nếu vẫn thiếu transitive dep của `mammoth`, cân nhắc cài prod-deps trong
      runner (`npm ci --omit=dev`) thay cho copy chọn lọc. **(chưa verify được ở môi trường hiện tại —
      không có Docker/Tectonic).**
- [x] CI xanh về mặt cấu hình (lint/test/build chạy local: xanh).

Ghi chú lần đầu chạy OCR sẽ tải `traineddata` (`OCR_LANGS`) từ mạng vào `TESSERACT_CACHE_DIR`;
prod nên prefetch model vào volume hoặc image để tránh phụ thuộc mạng lúc chạy.

---

## Phase 1 — Public beta có kiểm soát
Mục tiêu: mở cho người dùng ngoài, giới hạn lạm dụng.
- Auth cơ bản (gate ở proxy hoặc magic link); gắn `ownerId` vào `StoredDocument`, lọc theo chủ sở hữu.
- Rate-limit + quota **theo người dùng** (token AI/ngày, compile/phút), không chỉ theo IP.
- Backup `DATA_DIR` định kỳ + dọn tài liệu quá hạn.
- Observability: metric compile success rate, latency, token cost; alert 5xx/compile-service down.
- CSP/security headers mở rộng; kiểm tra giới hạn payload nhất quán với `MAX_*`.

Exit: nhóm người dùng thật dùng ổn; không truy cập chéo tài liệu; có dashboard số liệu.

---

## Phase 2 — Production đa người dùng
- DB thật (Postgres) + object storage cho PDF; migration từ file-store.
- Auth đầy đủ (session/OAuth) + phân quyền theo owner.
- Rate-limit phân tán (Redis); hàng đợi cho compile/OCR; scale compile-service sau LB.
- E2E + compile-regression suite trong CI (visual diff PDF — xem `docs/09-evaluation.md`).

Exit: đạt tải mục tiêu; có SLO compile success rate; định nghĩa RTO/RPO + backup/restore.

---

## Phase 3 — Mở rộng tính năng (roadmap v1/v2)
RAG grounding, Markdown→LaTeX (Pandoc), đa ngôn ngữ hạng nhất, agentic đa file, thêm template.
Đẩy dần sau feature flag, không chặn phát hành phần lõi.
