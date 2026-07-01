# Quickstart — Validate LaTeX Document Generation (MVP)

Hướng dẫn chạy & kiểm chứng feature end-to-end. Không chứa code triển khai (thuộc `tasks.md`).

## Prerequisites
- Docker + docker-compose.
- Node.js 20, npm.
- Khóa API của một nhà cung cấp AI (Anthropic mặc định) — dùng cho smoke; hầu hết test dùng `MockProvider`.

## Cấu hình
Sao chép `.env.example` → `.env` và đặt tối thiểu:
```
AI_PROVIDER=mock            # dùng 'anthropic' cho smoke thật
AI_API_KEY=...              # chỉ khi dùng provider thật
AI_MODEL=...
AI_TEMPERATURE=0.2
COMPILE_SERVICE_URL=http://compile-service:8080
MAX_REPAIR_ATTEMPTS=3
MAX_INPUT_CHARS=5000
REQUEST_TIMEOUT_MS=60000
```
(Compile service: `COMPILE_TIMEOUT_MS=45000`, `MAX_LATEX_BYTES=1000000`.)

## Chạy toàn stack
```
docker compose up --build
# mở http://localhost:3000
```

## Kịch bản kiểm chứng (map tới acceptance criteria & test cases)

### V1 — Happy path (US-1 / TC-01)
- Trên UI: chọn `article`, nhập "Bài báo ngắn tiếng Việt về năng lượng mặt trời, có abstract và 3 mục", bấm Tạo.
- **Expect**: xem trước PDF hợp lệ; tab source hiện LaTeX đầy đủ; nút tải PDF hoạt động; tiếng Việt hiển thị đúng.
- CLI tương đương:
  ```
  curl -s -X POST localhost:3000/api/document \
    -H 'content-type: application/json' \
    -d '{"description":"Bài báo ngắn về năng lượng mặt trời, 3 mục","docType":"article"}' | jq '.attempts, (.pdfBase64|length)'
  ```

### V2 — Repair loop (US-2 / TC-05)
- Dùng `MockProvider` kịch bản "lỗi lần 1 → đúng lần 2" (hoặc nạp `docs/testcases/fixtures/tc-05-broken.tex`).
- **Expect**: kết quả thành công với `attempts > 1`; nếu vượt `MAX_REPAIR_ATTEMPTS` → `{ error, latex, log, attempts }` (HTTP 200).

### V3 — Validate đầu vào & lỗi (US-3)
- Submit mô tả rỗng → bị chặn kèm hướng dẫn (không gọi API).
- Mô tả > `MAX_INPUT_CHARS` → 400.
- Bắn > 10 request/phút cùng IP → 429.

### V4 — An toàn compile (Nguyên tắc IV / doc 09 §9.1 mục 5)
- Gửi LaTeX chứa `\write18{...}` tới `/api/compile`.
- **Expect**: KHÔNG có lệnh shell nào chạy; trả log lỗi/từ chối; container vẫn non-root, không truy cập ngoài.

### V5 — Provider-agnostic (SC-007)
- Đổi `AI_PROVIDER=mock ↔ anthropic` (và `openai`) qua env, không sửa code nghiệp vụ; luồng chức năng không đổi.

## Chạy test
```
npm test                      # Vitest: unit + integration (MockProvider + compile mock)
# component test (RTL) chạy cùng Vitest
# compile-service:
cd compile-service && npm test
```
Test case đánh giá: đọc `docs/testcases/testcases.json`, lọc `scope=mvp` (TC-01/02/05) + security suite.

## Expected outcomes (Definition of Done ở mức feature)
- V1–V5 đạt kỳ vọng; toàn bộ chạy qua `docker compose up`.
- Đạt SC-001..007 ở [spec.md](./spec.md) (đặc biệt SC-002 compile success rate, SC-005 security 100%).
