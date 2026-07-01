# AI LaTeX Generator

Mô tả tài liệu bằng ngôn ngữ tự nhiên (tiếng Việt/Anh) → nhận **PDF LaTeX biên dịch thật** cùng mã
nguồn. Hệ thống sinh theo template (`article`/`report`), **kiểm cấu trúc trước khi dựng**, biên dịch
**an toàn** bằng Tectonic `--untrusted` trong sandbox, và **tự sửa lặp** khi lỗi.

Thiết kế đầy đủ: xem [`docs/`](./docs). Đặc tả spec-kit: [`specs/001-latex-document-generation/`](./specs/001-latex-document-generation).

## Kiến trúc
- **Next.js app** (UI + BFF orchestrator): `app/` + `lib/`.
- **compile-service** (Node/Express + Tectonic, sandbox): `compile-service/`.

## Chạy nhanh (dev, không cần compile thật)
```bash
cp .env.example .env    # AI_PROVIDER=mock để chạy offline
npm install
npm run dev             # http://localhost:3000
```
> Với `AI_PROVIDER=mock`, tầng AI trả LaTeX cố định. Để dựng PDF thật cần compile-service (Docker).

## Chạy toàn stack (Docker)
```bash
cp .env.example .env    # đặt AI_PROVIDER=anthropic + AI_API_KEY nếu muốn AI thật
docker compose up --build
# mở http://localhost:3000
```
`compile-service` không expose ra Internet; chỉ Next.js gọi nội bộ. Container compile chạy non-root,
read-only fs, giới hạn tài nguyên (mem 1g / cpu 1.0 / pids 256), Tectonic `--untrusted`, không shell-escape.

## Cấu hình (biến môi trường)
Xem [`.env.example`](./.env.example) và `docs/11-data-model.md` §11.6. Không commit giá trị secret.

## Kiểm thử
```bash
npm test                       # Vitest: unit + integration + component (dùng MockProvider)
cd compile-service && npm test # node:test (ca cần Tectonic sẽ skip nếu không có tectonic)
npm run lint && npm run build  # lint + build
```
Test-case đánh giá: `docs/testcases/testcases.json` (MVP: TC-01/02/05), chạy qua `tests/eval/`.

## Trạng thái
MVP: **nhiều template theo dạng tài liệu** (thuần văn bản, học thuật, toán học, vật lý, kỹ thuật,
luận văn) trên nền `article`/`report` + repair loop + sandbox, **lưu trữ file-based** (`DATA_DIR`) với **CRUD**
tài liệu và **chat-edit** (chỉnh sửa nội dung bằng ngôn ngữ tự nhiên + sửa mã nguồn thủ công + recompile).
RAG, Markdown→LaTeX, OCR, đa ngôn ngữ hạng nhất, chỉnh sửa đa file/agentic, auth & DB chia sẻ thuộc
v1/v2 — xem `docs/08-roadmap.md`.
