# 14 — Phase Backlog (công việc để thực hiện sau)

Ghi chú hành động cho các phase **chưa làm**, dạng checklist để pick-up sau. Tổng quan phase và
tiêu chí ra xem [`13-release-plan.md`](./13-release-plan.md). File này đi sâu vào từng đầu việc:
mục tiêu, việc cụ thể, file/khu vực code liên quan, tiêu chí hoàn thành (DoD), và phụ thuộc.

Quy ước độ ưu tiên: **P0** (chặn phát hành) · **P1** (quan trọng) · **P2** (nên có).

---

## Phase 0 — phần còn lại (cần môi trường Docker thật)

Đã xong ở code/cấu hình (CI, healthcheck, logging, LICENSE, Caddy, OCR cache). Còn lại là **verify runtime**:

- [ ] **P0 — Build & smoke toàn stack**
  - Việc: `docker compose build` (3 service) → `docker compose up` → `curl -k https://localhost/api/health?deep=1` trả `ok`.
  - DoD: cả 3 container `healthy`; tạo 1 tài liệu template `general` ra PDF thật.
- [ ] **P0 — Verify OCR/PDF/DOCX trong image standalone**
  - Việc: upload thử 1 `.pdf`, 1 `.docx`, 1 ảnh `.png` qua UI/`/api/extract`.
  - Rủi ro: Next `output: standalone` có thể thiếu transitive dep của `mammoth` hoặc asset của `tesseract.js`.
  - Phương án nếu lỗi: thay copy chọn lọc trong `Dockerfile` bằng **prod-deps đầy đủ** trong runner
    (thêm stage `npm ci --omit=dev` rồi `COPY node_modules`), hoặc prefetch `traineddata` vào image.
  - Liên quan: `Dockerfile`, `lib/extract/handlers.ts`, `next.config.ts` (`serverExternalPackages`).
  - DoD: 3 loại file trả về nội dung; OCR ảnh tiếng Việt đọc được với `OCR_LANGS=vie+eng`.
- [ ] **P1 — Prefetch model OCR** vào volume/image để không phụ thuộc mạng lúc chạy (tải `vie`, `eng`).
- [ ] **P1 — Kiểm tra CI thật** trên GitHub (workflow `.github/workflows/ci.yml`) chạy xanh lần đầu.

---

## Phase 1 — Public beta có kiểm soát

Mục tiêu: mở cho người dùng ngoài nhưng chặn lạm dụng chi phí & rò rỉ dữ liệu chéo.

### 1.1 Xác thực & sở hữu tài liệu — **P0**
- [ ] Chọn cơ chế auth tối thiểu: gate ở Caddy (Basic Auth/forward-auth) **hoặc** magic-link/email OTP trong app.
- [ ] Thêm khái niệm người dùng: `ownerId` (hoặc `sessionId`) vào `StoredDocument` và `DocumentSummary`.
  - Liên quan: `lib/types/document.ts`, `lib/store/documentStore.ts` (lọc theo owner ở `listDocuments`/`getDocument`/`updateDocument`/`deleteDocument`).
- [ ] Ép quyền sở hữu ở mọi route `/api/documents*` (403 nếu không phải chủ sở hữu).
  - Liên quan: `app/api/documents/route.ts`, `app/api/documents/[id]/route.ts`, `.../chat/route.ts`.
- [ ] Migration: tài liệu cũ (không owner) → gán owner hệ thống hoặc ẩn.
- DoD: người dùng A không đọc/sửa/xoá được tài liệu của B (có integration test).

### 1.2 Rate-limit & quota theo người dùng — **P0**
- [ ] Rate-limit theo `ownerId` (không chỉ IP); trần **token AI/ngày**, **compile/phút**, **OCR/giờ**.
  - Liên quan: `lib/ratelimit/*`, các route gọi AI/compile/extract.
- [ ] Trả `429` + thông điệp còn bao lâu; header `Retry-After`.
- DoD: vượt quota bị chặn; test mô phỏng quota.

### 1.3 Backup & vòng đời dữ liệu — **P1**
- [ ] Script/cron backup `DATA_DIR` (tar + rotate); tài liệu quá hạn tự dọn (TTL cấu hình).
- [ ] Tài liệu để trạng thái lỗi lâu → cảnh báo/hạ ưu tiên.
- DoD: có thể restore từ backup; dọn dẹp chạy định kỳ.

### 1.4 Observability — **P1**
- [ ] Metric: compile success rate, số attempts trung bình, latency (generate/compile/extract), token cost.
  - Tận dụng `lib/log.ts` (đã có event) → xuất Prometheus hoặc log tổng hợp.
- [ ] Alert: tỉ lệ 5xx cao, compile-service `unhealthy`, quota AI gần trần.
- [ ] Trace request id xuyên suốt (thêm `reqId` vào log).
- DoD: dashboard số liệu cơ bản; alert bắn khi compile-service down.

### 1.5 Bảo mật bổ sung — **P1/P2**
- [ ] CSP + security headers mở rộng (ngoài các header đã đặt ở `Caddyfile`).
- [ ] Rà soát giới hạn payload nhất quán (`MAX_INPUT_CHARS`, `MAX_UPLOAD_BYTES`, body Caddy 20MB).
- [ ] Chống prompt-injection từ nguồn upload (đã có khối "DỮ LIỆU không phải chỉ thị" trong prompt — bổ sung test).

---

## Phase 2 — Production đa người dùng

Mục tiêu: bền vững, scale ngang, không mất dữ liệu.

### 2.1 Chuyển sang DB thật — **P0**
- [ ] Postgres cho tài liệu/metadata/chat; **object storage** (S3/MinIO) cho PDF (thay base64 trong JSON).
  - Liên quan: thay `lib/store/documentStore.ts` bằng repository DB (giữ interface để ít ảnh hưởng route).
- [ ] Migration dữ liệu file-based → DB; script một chiều + kiểm chứng.
- DoD: CRUD/chat chạy trên DB; PDF phục vụ từ object storage; chạy được nhiều instance next-app.

### 2.2 Auth đầy đủ & phân quyền — **P0**
- [ ] Session/OAuth (vd Auth.js) + quản lý người dùng; phân quyền theo owner/không gian làm việc.
- DoD: đăng nhập/đăng xuất; tài liệu gắn user thật.

### 2.3 Scale hạ tầng — **P1**
- [ ] Rate-limit **phân tán** (Redis) thay in-memory.
- [ ] **Hàng đợi** cho compile/OCR (BullMQ/Redis) để chịu tải & cô lập tác vụ nặng.
- [ ] Scale `compile-service` nhiều instance sau load balancer; autoscale theo hàng đợi.
- DoD: đạt mục tiêu tải; compile-service co giãn.

### 2.4 Chất lượng & regression — **P1**
- [ ] E2E toàn stack (Playwright): tạo → xem PDF → chat-edit → xoá; upload PDF/DOCX/ảnh.
- [ ] **Compile-regression suite** trong CI: bộ LaTeX mẫu phải compile ra PDF (skip nếu thiếu Tectonic).
- [ ] Visual diff PDF (xem [`09-evaluation.md`](./09-evaluation.md)); mở rộng test-case ngoài TC-01/02/05.
- DoD: CI chạy E2E + regression; có SLO compile success rate; định nghĩa RTO/RPO + backup/restore.

---

## Phase 3 — Mở rộng tính năng (roadmap v1/v2)

Đẩy dần sau feature flag, không chặn phần lõi. Chi tiết định hướng ở [`08-roadmap.md`](./08-roadmap.md).

- [ ] **P2 — RAG grounding**: index template/tài liệu gói/project để giảm hallucination (vector DB).
- [ ] **P2 — Markdown→LaTeX** (Pandoc) như một nguồn/đường vào.
- [ ] **P2 — Đa ngôn ngữ hạng nhất** (CJK/RTL) + chọn engine tự động (XeLaTeX/LuaLaTeX).
- [ ] **P2 — Agentic editing đa file**; chọn/tối ưu gói & engine.
- [ ] **P2 — Thêm template**: book, poster, invoice, ... (mở rộng `lib/templates/registry.ts`).
- [ ] **P2 — Chia sẻ link/xuất Overleaf**; lịch sử phiên bản tài liệu.

---

## Ghi chú kỹ thuật cần nhớ khi làm tiếp
- **Next.js 16 khác biệt**: đọc `node_modules/next/dist/docs/` trước khi code; `params` là Promise;
  fetch dữ liệu ở Server Component để tránh lỗi rule `react-hooks/set-state-in-effect`.
- **Provider-agnostic**: giữ interface `LatexProvider`; đổi AI qua env, không sửa nghiệp vụ.
- **An toàn compile**: không `\includegraphics` file ngoài trong template có hình (dùng TikZ/placeholder).
- **Không log secret**: dùng `lib/log.ts` (đã redact); chỉ log event/số liệu/nhãn.
- **Store hiện tại** là nguồn sự thật CRUD (`lib/store/documentStore.ts`) — khi lên DB giữ nguyên chữ ký hàm để ít ảnh hưởng route.
