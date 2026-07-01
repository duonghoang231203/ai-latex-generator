# Phase 0 — Research: LaTeX Document Generation (MVP)

Mọi mục "NEEDS CLARIFICATION" đã được giải quyết qua bộ `docs/`, hiến pháp, và phiên `clarify`
(2026-07-01). Dưới đây là hợp nhất quyết định. Nguồn nền: xem `docs/10-references.md`.

## R1 — Compile engine & chế độ an toàn
- **Decision**: Tectonic (engine XeTeX) chạy chế độ `--untrusted`, trong container Docker non-root,
  read-only filesystem (trừ thư mục tạm), không expose Internet, giới hạn tài nguyên + timeout.
- **Rationale**: Tectonic tự tải package CTAN, compile đa pass, có cache, một binary dễ Docker hóa;
  `--untrusted` vô hiệu hóa tính năng nguy hiểm. Bắt buộc bởi Nguyên tắc IV; không dựa duy nhất vào
  cờ (lỗ hổng LuaTeX) nên cô lập container là bắt buộc.
- **Alternatives**: WASM (SwiftLaTeX) — hạn chế package, nặng tải client, hợp preview snippet hơn;
  TeX Live đầy đủ — nặng, khó đóng gói. Đều bị loại cho MVP.

## R2 — Engine cho Unicode/tiếng Việt
- **Decision**: XeLaTeX (chính là XeTeX của Tectonic) + `fontspec` (+ `polyglossia` khi cần), font
  hỗ trợ tiếng Việt.
- **Rationale**: Tectonic dựa XeTeX → Unicode hạng nhất, không cần `inputenc` mong manh của pdfLaTeX.
- **Alternatives**: pdfLaTeX + inputenc/babel — dễ vỡ với tiếng Việt/đa ngôn ngữ; loại ở MVP.

## R3 — Thư viện AST validation
- **Decision**: `latex-utensils` làm parser chính cho lớp validation MVP.
- **Rationale**: parser LaTeX/BibTeX thuần JS/TS, xuất AST + vị trí lỗi (dòng/cột), ném lỗi parse rõ
  ràng → hợp tạo diagnostics cho repair loop; đã kiểm nghiệm (LaTeX Workshop).
- **Alternatives**: `unified-latex` (mạnh về manipulation → để dành v1); `tree-sitter-latex`
  (incremental/error-tolerant → hợp editor, v1+). AST là best-effort; compiler là nguồn sự thật cuối.

## R4 — Nhà cung cấp AI & tham số
- **Decision**: Anthropic Claude mặc định (`AI_PROVIDER=anthropic`), model qua `AI_MODEL`,
  `temperature=0.2`; ẩn sau interface `LatexProvider`; `MockProvider` cho test.
- **Rationale**: chất lượng sinh LaTeX + đọc log lỗi TeX tốt; temperature thấp tăng ổn định/compile-được.
- **Alternatives**: OpenAI GPT — phương án thay thế ngang hàng, đổi bằng env (provider-agnostic).

## R5 — Chiến lược sinh: template-first
- **Decision**: Sinh nội dung vào khung `article`/`report` (chỉ 2 lớp, đã clarify), system prompt chặt
  (chỉ package phổ biến, cấm shell-escape), sanitize output (bóc fence, kiểm `\documentclass`/
  `\begin{document}`/`\end{document}`).
- **Rationale**: giảm variance, tăng compile-được; grounding gián tiếp qua công cụ (parser+compiler).
- **Alternatives**: sinh tự do toàn văn — variance cao, khó compile; loại. RAG grounding — hoãn v1.

## R6 — Vòng lặp tự sửa
- **Decision**: generate → AST validate → compile → patch, tối đa `MAX_REPAIR_ATTEMPTS` (mặc định 3 =
  1 lần đầu + 2 sửa). `errorContext` mang `previousLatex` + diagnostics (AST) hoặc log (Tectonic, rút gọn).
- **Rationale**: AST rẻ bắt lỗi sớm tiết kiệm lượt compile; compiler xác nhận cuối; giới hạn lặp chặn
  vòng vô hạn & kiểm soát chi phí.
- **Alternatives**: chỉ compile không AST — tốn lượt compile; lặp vô hạn — rủi ro chi phí. Loại.

## R7 — Hợp đồng truyền dữ liệu
- **Decision**: `/api/document` trả **base64 JSON** (single response, không streaming ở MVP);
  `/api/compile` và compile-service `/compile` trả **PDF binary**; repair-fail trả **HTTP 200** kèm
  `{ error, latex, log, attempts }`.
- **Rationale**: orchestrator cần đóng gói nhiều trường; endpoint compile thuần ưu tiên hiệu quả;
  repair-fail là kết quả nghiệp vụ bình thường (đã clarify chọn single response).
- **Alternatives**: streaming SSE — để dành v1; 422 cho repair-fail — loại (khó cho UI phân biệt).

## R8 — Rate limiting
- **Decision**: token-bucket in-memory theo IP, mặc định **10 req/phút/IP** (cấu hình qua env), áp cho
  `/api/document`.
- **Rationale**: cân bằng chống lạm dụng endpoint tốn AI+compile với trải nghiệm; đã clarify.
- **Alternatives**: Redis phân tán — cần khi scale nhiều instance (v1+); 5/20 req/phút — loại theo clarify.

## R9 — Next.js 16 (ràng buộc kỹ thuật)
- **Decision**: Route Handlers chạy Node runtime (cần cho compile/AI), endpoint AI/compile
  **dynamic/không cache**; async request APIs phải `await`; giữ secret ở server, không rò sang client.
- **Rationale**: bản 16.2.9 có breaking changes; phải theo `node_modules/next/dist/docs/` (đã xác nhận
  tồn tại). Tránh dùng API cũ theo trí nhớ.
- **Alternatives**: Edge runtime — không chạy được binary/compile; loại cho các route này.

## R10 — Test & đánh giá
- **Decision**: Vitest + RTL; `MockProvider` mô phỏng happy/AST-repair/compile-repair/fail; bộ 8 ca
  máy đọc được (`docs/testcases/testcases.json`, MVP: TC-01/02/05) + security suite.
- **Rationale**: test không tốn tiền/không phụ thuộc mạng; đo compile success rate, parse-pass rate,
  attempts, security pass (Nguyên tắc VI + doc 09).
- **Alternatives**: chỉ test provider thật — tốn kém, giòn trong CI; loại.
