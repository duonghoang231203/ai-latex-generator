# AI LaTeX Generator — Tài liệu thiết kế

**AI LaTeX Generator** là một **document engineering system**: người dùng mô tả tài liệu bằng
ngôn ngữ tự nhiên, hệ thống sinh ra một **gói dự án LaTeX compile được, đúng ngữ nghĩa,
đúng template và an toàn khi compile**, rồi render ra PDF ngay trong ứng dụng.

> **Định vị quan trọng** (theo nghiên cứu sâu): đây **không** phải "chatbot viết file `.tex`".
> Bài toán đúng là sinh ra *gói artifact LaTeX đáng tin cậy*, nên giải pháp là một **pipeline có cấu trúc**:
> template-first, LLM-assisted, (retrieval-grounded), **AST-validated**, **compiler-in-the-loop**, **sandbox-protected**.
> Châm ngôn thiết kế: **"LLM viết; parser kiểm; compiler xác nhận; sandbox bảo vệ; retrieval giữ chuẩn."**

> Trạng thái: **Thiết kế (chưa code)**. Đây là tài liệu kế hoạch, làm cơ sở cho giai đoạn triển khai.

## Tóm tắt quyết định (đã chốt cho MVP)

| # | Chủ đề | Quyết định MVP |
|---|--------|-----------|
| 1 | Phạm vi input → output | Text (ngôn ngữ tự nhiên) → **gói LaTeX đầy đủ** → PDF |
| 2 | Đầu ra | **Compile ra PDF thật** (artifact: `.tex` + PDF + logs) |
| 3 | AI provider | **Provider-agnostic** (pluggable), mặc định Claude/GPT |
| 4 | Compile engine | **Tectonic** server-side trong **Docker**, chế độ `--untrusted` |
| 5 | Loại tài liệu (MVP) | Chỉ **article** và **report** (template-first) |
| 6 | Trạng thái/Auth | **Lưu trữ file-based** (`DATA_DIR`) + CRUD + chat-edit; **chưa có auth** (không đăng nhập); tải PDF về |
| 7 | Engine mặc định | **XeLaTeX** (Tectonic/XeTeX) + `fontspec`/`polyglossia` cho tiếng Việt/Unicode |
| 8 | Thư viện AST | **latex-utensils** (MVP validation); unified-latex để dành v1 (manipulation) |
| 9 | Provider mặc định | **Anthropic Claude** (`AI_PROVIDER=anthropic`), `temperature=0.2` |
| 10 | Truyền PDF | `/api/document`: **base64/JSON**; `/api/compile`: **binary** |
| 11 | Status khi repair fail | **HTTP 200** kèm `{ error, latex, log, attempts }` |

Các năng lực lớn hơn (RAG, Markdown→LaTeX, sửa project nhiều file, OCR công thức, multilingual
hạng nhất, self-host/local-first) nằm trong **roadmap v1/v2** — xem [08-roadmap.md](./08-roadmap.md).

## Mục lục

| File | Nội dung |
|------|----------|
| [01-problem-definition.md](./01-problem-definition.md) | Định nghĩa bài toán (artifact package), pain points, 5 cụm use case, phân tích đối thủ |
| [02-requirements.md](./02-requirements.md) | Yêu cầu chức năng (FR) & phi chức năng (NFR), multilingual, privacy, copyright |
| [03-architecture.md](./03-architecture.md) | Kiến trúc mục tiêu (RAG/AST/sandbox) vs subset MVP, data flow, tech stack |
| [04-frontend.md](./04-frontend.md) | Thiết kế Frontend: UI, component, state, UX |
| [05-backend.md](./05-backend.md) | Thiết kế Backend: API routes, hợp đồng dữ liệu, lỗi |
| [06-ai-integration.md](./06-ai-integration.md) | Template-first, prompt, **AST validation**, vòng lặp compiler-in-the-loop, RAG (tương lai) |
| [07-compile-service.md](./07-compile-service.md) | Compile sandbox Tectonic `--untrusted`, Docker, rủi ro bảo mật |
| [08-roadmap.md](./08-roadmap.md) | Roadmap phân tầng **MVP / v1 / v2**, task breakdown |
| [09-evaluation.md](./09-evaluation.md) | Tiêu chí đánh giá + bộ 8 test case + metrics |
| [10-references.md](./10-references.md) | Bảng nguồn nghiên cứu + thư viện/công cụ tham khảo |
| [11-data-model.md](./11-data-model.md) | **Data model & API contracts tập trung** (nguồn chuẩn cho type/hợp đồng) |
| [testcases/](./testcases/) | Bộ 8 ca đánh giá **máy đọc được** (`testcases.json` + schema + fixtures) |

> **Hiến pháp dự án**: các nguyên tắc bất biến (test-first, security-first, provider-agnostic,
> template-first, verification pipeline, ràng buộc Next.js 16) được chốt tại
> [`.specify/memory/constitution.md`](../.specify/memory/constitution.md). Khi xung đột, hiến pháp thắng.

## Tech stack

- **Frontend/BFF**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **AI**: Provider-agnostic interface (Anthropic Claude / OpenAI GPT)
- **Validation**: AST/parser layer (tree-sitter-latex / unified-latex / latex-utensils) — kiểm trước compile
- **Compile**: Tectonic (TeX engine) trong Docker microservice, chế độ `--untrusted`
- **Preview**: pdf.js (PDF), KaTeX/MathJax (math) — cho preview nhanh ở các phase sau
- **Test**: Vitest (unit/integration) + React Testing Library (component)
- **Hạ tầng**: docker-compose (Next.js app + compile sandbox)

## Giá trị cốt lõi (điểm khác biệt)

Thị trường đã có Overleaf (mạnh collaboration, không AI-first), các editor AI-native còn rất sớm
(Octree, Open-Prism, LMMs-Lab Writer), và các luồng "không bắt viết LaTeX tay" (Pandoc, Manubot, Quarto).
Khoảng trống là **độ tin cậy của tài liệu (document reliability)**: sinh ra thứ **compile được, sửa được
lặp lại, an toàn khi compile**.

Điểm khác biệt của ta là **vòng lặp generate → AST validate → compile → patch**: nếu output không hợp lệ
hoặc compile lỗi, hệ thống dùng chẩn đoán của parser + log của Tectonic để tự sửa, lặp đến khi ra PDF hợp lệ.
Đây là cách trực tiếp giải quyết pain point lớn nhất: *AI sinh LaTeX trông đúng nhưng không compile được*.
