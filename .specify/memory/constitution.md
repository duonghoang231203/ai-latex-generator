# AI LaTeX Generator Constitution

Hiến pháp này chốt các nguyên tắc bất biến của dự án. Mọi spec, plan, task và code review
phải tuân thủ. Khi có xung đột giữa tài liệu thiết kế (`docs/`) và hiến pháp, **hiến pháp thắng**.

## Core Principles

### I. Document Reliability First (định vị bài toán)
Đây là một **document engineering system**, KHÔNG phải "chatbot viết `.tex`". Giá trị bán ra là
**độ tin cậy của tài liệu**: đầu ra phải (1) đúng ngữ nghĩa, (2) biên dịch được, (3) phù hợp
template/venue, (4) an toàn khi compile. Đầu ra là một **gói artifact** (`.tex` + PDF + logs +
metadata), không phải một chuỗi văn bản. Mọi tính năng phải phục vụ độ tin cậy này; "nghe hợp lý
nhưng không compile" bị coi là thất bại.

### II. Template-First Generation
LLM sinh nội dung vào **khung template** đã chọn (`article`/`report` ở MVP), không sinh tự do toàn
văn. Ràng buộc này giảm variance, tăng tỷ lệ compile được và giữ chuẩn venue. Thêm loại tài liệu
mới phải đi qua hệ thống template/prompt, không hardcode trong code nghiệp vụ.

### III. Verification Pipeline — "LLM viết; parser kiểm; compiler xác nhận"
Mọi output của LLM phải qua hai lớp canh gác trước khi được chấp nhận:
1. **AST validation** (best-effort, rẻ) bắt sớm lỗi cấu trúc trước khi tốn một lượt compile.
2. **Compiler-in-the-loop**: compiler (Tectonic) là **nguồn sự thật vận hành cuối cùng**.
LaTeX là Turing-complete nên AST không bao giờ là nguồn sự thật; khi AST và compiler bất đồng,
compiler thắng. Vòng lặp generate → validate → compile → patch bị chặn bởi `MAX_REPAIR_ATTEMPTS`.

### IV. Security-First Compilation (NON-NEGOTIABLE)
Compile service chạy binary TeX trên **input không tin cậy** → bảo mật là tiêu chí **ngang hàng
với compilability**, không phải "thêm cho có". Bắt buộc:
- Tectonic chạy chế độ `--untrusted`; **TUYỆT ĐỐI KHÔNG** bật `--shell-escape`.
- Không dựa duy nhất vào cờ (lỗ hổng LuaTeX cho phép shell-exec ngay cả khi shell-escape tắt) →
  **bắt buộc cô lập container**: non-root, read-only filesystem (trừ thư mục tạm), không expose ra
  Internet, giới hạn CPU/RAM/pids/thời gian, dọn thư mục tạm sau mỗi request.
- API key chỉ ở server-side; không log secret; không gửi key ra client.
Vi phạm bất kỳ điểm nào trên là lỗi chặn release.

### V. Provider-Agnostic AI
AI provider ẩn sau **một interface duy nhất** (`LatexProvider`). Code nghiệp vụ chỉ biết interface,
không biết Claude/GPT/Mock. Đổi provider = đổi biến môi trường, **không sửa code nghiệp vụ**.
`MockProvider` là bắt buộc để test toàn bộ orchestrator không tốn tiền/không phụ thuộc mạng.

### VI. Test-First & Incremental Delivery
- Mỗi task cho ra một phần **chạy được/demo được**; không để code "mồ côi".
- Logic mới phải có test và **test xanh** trước khi coi là Done; build/lint không lỗi; không làm
  vỡ phần trước đó.
- Hầu hết test dùng `MockProvider` + compile service mock; provider/engine thật chỉ chạy smoke/contract.
- Security suite và bộ test case đánh giá (xem `docs/09-evaluation.md`, `docs/testcases/`) là một
  phần của định nghĩa Done cho các task liên quan.

## Additional Constraints (Technology & Scope)

- **Stack cố định**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 (đã khởi tạo).
  Compile bằng **Tectonic** trong Docker (không WASM ở MVP). Test bằng Vitest + React Testing Library.
- **Next.js 16 là bản có breaking changes**: BẮT BUỘC đọc `node_modules/next/dist/docs/` (theo
  `AGENTS.md`/`CLAUDE.md`) trước khi viết code liên quan Next.js; không dùng API/convention cũ theo
  trí nhớ.
- **Phạm vi MVP**: cụm use case (1) soạn tài liệu mới (`article`/`report`) + một phần (3) repair loop.
  RAG, multi-file, conversion, OCR, auth, multilingual hạng nhất thuộc v1/v2 — không nhồi vào MVP.
- **Stateless ở MVP**: không auth, không lưu trữ; kiến trúc để mở cho auth/storage sau.

## Development Workflow & Quality Gates

- Tuân theo luồng spec-kit: constitution → specify → (clarify) → plan → tasks → (analyze/checklist)
  → implement.
- Quyết định kiến trúc quan trọng ghi lại dạng ADR (xem `docs/03-architecture.md` §3.8).
- Quality gate mỗi task: test xanh + lint/build sạch + demo được + không regression.
- Bảo mật (Nguyên tắc IV) và Verification Pipeline (Nguyên tắc III) là **gate chặn**: không được
  bỏ qua để "đi nhanh".

## Governance

Hiến pháp này thay thế mọi thực hành xung đột khác. Mọi PR/review phải xác minh tuân thủ 6 nguyên
tắc. Sửa đổi hiến pháp phải: (1) ghi rõ lý do, (2) cập nhật phiên bản theo semver
(MAJOR: đổi/xóa nguyên tắc; MINOR: thêm nguyên tắc/mục; PATCH: làm rõ câu chữ), (3) đồng bộ các
tài liệu phụ thuộc trong `docs/`. Độ phức tạp vượt mức phải được biện minh; nếu không, chọn phương
án đơn giản hơn (YAGNI).

**Version**: 1.0.0 | **Ratified**: 2026-07-01 | **Last Amended**: 2026-07-01
