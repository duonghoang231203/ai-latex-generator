# Feature Progress Tracking

Bảng theo dõi tiến độ các tính năng của dự án AI LaTeX Generator.

## 🟢 Phase 1: MVP (Đã hoàn thành)

| Trạng thái | Tính năng | Mô tả chi tiết |
| :---: | :--- | :--- |
| ✅ | **Document generation** | Hỗ trợ tạo mới tài liệu dựa trên nhiều loại template khác nhau. |
| ✅ | **LaTeX compilation** | Hệ thống sandbox sử dụng `tectonic` để biên dịch mã nguồn LaTeX thành PDF. Đã xử lý cơ chế fallback V2-V1 và local cache. |
| ✅ | **Auto-repair compilation loop** | Vòng lặp tự động bắt lỗi biên dịch và gửi lại log cho AI để sửa lỗi (re-compile loop). |
| ✅ | **File-based CRUD operations** | Quản lý tài liệu đã lưu (create, read, update, delete). |
| ✅ | **Chat-based iterative editing** | Chỉnh sửa tài liệu lặp đi lặp lại thông qua chỉ thị chat với người dùng. |
| ✅ | **UI Status Tracking** | Cập nhật API routes để gửi sự kiện compiling (SSE) sớm cho client, cập nhật UI real-time. |

---

## 🟡 Phase 2: Advanced Features (Đang tiến hành / Sắp tới)

| Trạng thái | Tính năng | Mô tả chi tiết | Người phụ trách / Ghi chú |
| :---: | :--- | :--- | :--- |
| 🔲 | **E1 · Multi-file project support (Core)** | Kiến trúc lưu trữ dạng thư mục (Directory-based storage) phục vụ tài liệu lớn. | Theme: Scale · Ưu tiên **1** (enabler) · Effort L |
| ✅ | **E5 · Markdown → LaTeX conversion** | Viết nháp bằng định dạng Markdown, tự động chuyển sang chuẩn LaTeX. | Theme: Authoring speed · Ưu tiên **2** (quick win) · Effort S–M · **Done** |
| ✅ | **E3 · RAG (Retrieval-Augmented Generation)** | Truy hồi tài liệu tham khảo (upload) để AI viết nội dung chính xác, có trích dẫn nguồn. | Theme: Content accuracy · Ưu tiên **3** · Effort M–L · **Done** (mặc định tắt: `RAG_ENABLED`) |
| 🔲 | **E2 · Agentic multi-step document assembly** | Cơ chế tạo dàn ý và tự động viết nội dung theo dạng Checklist (Human-in-the-loop). | Theme: Smart assembly · Ưu tiên **4** (sau E1) · Effort L |
| 🔲 | **E4 · OCR công thức Toán/Lý/Hóa** | Nhận diện công thức Toán/Lý/Hóa từ hình ảnh thành mã LaTeX. | Theme: Multimodal input · Ưu tiên **5** · Effort M |
| 🔲 | **E6 · Prompt Engineering** | Cải thiện hệ thống prompt toàn dự án: system prompt, repair/edit prompt, per-template guidance, RAG injection, đo lường chất lượng. | Theme: Output quality · Ưu tiên **3** (cross-cutting) · Effort M |
| 🔲 | **E7 · Clarification Layer** | Bước hiểu yêu cầu (Request Understanding) trước generate: sinh `RequestPlan` có cấu trúc, code quyết định generate ngay hay hỏi lại qua tool `askUserQuestion` dùng chung toàn app. | Theme: Request understanding · Ưu tiên **6** (sau E6, cần eval data) · Effort L |

---

## ⚪ Phase 3: Platform Maturity (Kế hoạch tương lai)

| Trạng thái | Tính năng | Mô tả chi tiết |
| :---: | :--- | :--- |
| 🔲 | **Authentication & Database (v2)** | Multi-user Auth (Đăng nhập, phân quyền) & Lưu trữ trên Database (Postgres/Mongo) thay vì local files. |
| 🔲 | **Advanced deployment strategies** | Triển khai trên môi trường Cloud, Dockerization, thiết lập CI/CD pipeline. |

---

## 📋 Task Breakdown (trích xuất từ Roadmap)

Các đầu việc cụ thể được trích xuất từ [`project-roadmap.md`](./project-roadmap.md) cho từng tính năng. Dùng để theo dõi tiến độ chi tiết (đánh dấu `[x]` khi hoàn thành từng đầu việc). Các epic Phase 2 được sắp theo **thứ tự ưu tiên của roadmap: E1 → E5 → E3 → E2 → E4 → E6 (song song, cross-cutting) → E7 (sau E6, cần eval data)**.

### 🟡 Phase 2 — Advanced Features

#### E1 · Multi-file project support (Core) — *Scale*
>
> 📄 Giải thích (thiết kế): [`features/e1-multi-file-project/explainer.md`](./features/e1-multi-file-project/explainer.md) · ⚠️ chưa implement
> 🧪 Spike (đã xong 2026-07-09): [`features/e1-multi-file-project/spike-tectonic-multifile.md`](./features/e1-multi-file-project/spike-tectonic-multifile.md) — `\input`/`\include`/asset chạy được dưới Tectonic `--untrusted`; **path-guard bắt buộc**.
> 🏗️ **Architecture Task:** [`features/e1-multi-file-project/task-hybrid-architecture.md`](./features/e1-multi-file-project/task-hybrid-architecture.md) — Chuyển từ monolithic generation sang Hybrid Generation.

- [ ] **Task: Design Hybrid Document Generation Architecture (Làm đầu tiên cho E1)**
  - [ ] 1. Define `DocumentPlan` (structured output schema).
  - [ ] 2. Define project structure (App code owns structure, templates, assembly).
  - [ ] 3. Generate LaTeX theo từng section (`generateSection` thay vì `generateWholeDocument`).
  - [ ] 4. Deterministic assembly (App code writes files, merges project).
  - [ ] 5. Scoped repair (Identify affected scope, repair only that section, re-compile).
- [ ] Thiết kế mô hình lưu trữ dạng thư mục: mỗi tài liệu = 1 folder chứa nhiều file `.tex` + assets (thay cho trường `latex` đơn trong `StoredDocument`). → *increment 1: đã hỗ trợ dự án multi-file **text** trong layout JSON hiện tại (`files[]`); layout thư mục cho **asset nhị phân** hoãn lại.*
- [ ] Cập nhật `lib/store/documentStore.ts` sang cấu trúc directory-based (đọc/ghi/liệt kê nhiều file). → *đã: lưu/đọc `files[]`+`rootFile` trong JSON (migration-on-read: thiếu `rootFile` ⇒ file đầu). Directory-based vật lý (asset nhị phân) hoãn.*
- [x] Mở rộng data model `lib/types/document.ts`: danh sách file, file gốc (root/main), quan hệ `\input`/`\include`. → `ProjectFile`, `StoredDocument.files?/rootFile?`, `UpdateDocumentPatch` cho phép `files/rootFile`. Cầu nối single↔multi: `lib/store/project-document.ts` (`getProjectFiles`/`getRootFile`/`validateProject`, tái dùng path-guard). Tests: `tests/unit/{project-document,store-project}.test.ts`.
- [x] Cập nhật `compile-service` để nhận nhiều file (main + phụ) và biên dịch từ file gốc. → `compileProject(files, rootFile)` + `/compile` nhận `{files,rootFile}` (tương thích ngược `{latex}`) + **path-guard** `safeProjectPath` (chặn traversal — spike cho thấy `--untrusted` không tự chặn). Client: `lib/compile/{project-path,client}.ts`. Tests: `compile-service/test/project.test.js`, `tests/unit/{project-path,compile-client-project}.test.ts`.
- [ ] UI: cây thư mục / tab file, chọn file gốc để biên dịch.
- [ ] Wiring orchestrator: dùng `compileProject(getProjectFiles(doc), getRootFile(doc))` cho tài liệu multi-file (hiện `runDocument*` vẫn single-file). → *đã: `runProject()` (validate→compile cả dự án→repair file gốc, giới hạn v1) + `OrchestratorDeps.compileProject` + `/api/compile` nhận `{files,rootFile}`. Tests: `tests/unit/project-orchestrator.test.ts`, `tests/integration/api-compile-project.test.ts`. Còn: móc vào luồng TẠO tài liệu (chờ UI/E2 sinh multi-file) + rebuild image compile-service để HTTP e2e dùng code mới.*
- [ ] Migration: chuyển tài liệu single-file hiện có sang cấu trúc mới. → *một phần: đọc tương thích đã có; chưa cần chuyển đổi vật lý vì vẫn dùng JSON.*

#### E5 · Markdown → LaTeX conversion — *Authoring speed*
>
> 📄 Nghiên cứu / cách tiếp cận: [`features/e5-markdown-to-latex/research.md`](./features/e5-markdown-to-latex/research.md) · Kế hoạch: [`features/e5-markdown-to-latex/plan.md`](./features/e5-markdown-to-latex/plan.md)

- [x] Bộ chuyển Markdown → LaTeX (heading, list, bảng, code, ảnh, công thức `$...$`). → `lib/markdown/*` (converter tất định trên markdown-it + rule math giữ raw).
- [x] Chế độ soạn nháp bằng Markdown trong UI kèm xem trước. → `app/components/ChatAssistant.tsx` (toggle Markdown + preview MD→HTML).
- [x] Ánh xạ cú pháp Markdown sang template LaTeX đang chọn. → `wrapBodyInTemplate()` trong `registry.ts` + `runDocumentFromMarkdown()` trong orchestrator.
- [x] Kiểm thử trên các mẫu Markdown phổ biến (đảm bảo compile được). → `tests/unit/markdown-to-latex.test.ts`, `markdown-orchestrator.test.ts`, `input-markdown.test.ts`.

#### E3 · RAG (Retrieval-Augmented Generation) — *Content accuracy*
>
> 📄 Nghiên cứu / cách tiếp cận: [`features/e3-rag/research.md`](./features/e3-rag/research.md) · Kế hoạch: [`features/e3-rag/plan.md`](./features/e3-rag/plan.md)

- [x] Ingest tài liệu tham khảo (upload) → tách đoạn (chunking). → `lib/rag/chunk-source-text.ts` (tái dùng `lib/extract` sẵn có).
- [x] Sinh embeddings + lưu vào vector store (đánh giá & chọn giải pháp: local vs. dịch vụ). → `EmbeddingProvider` (mock mặc định + transformers tuỳ chọn) + `InMemoryVectorStore` + cache theo hash.
- [x] Truy hồi (retrieve) đoạn liên quan theo mô tả người dùng, chèn vào prompt trong `lib/ai/prompts.ts`. → `retrieveRelevantSources` (top-k + MMR) chạy ở orchestrator; `sourcesBlock` nhánh `retrievedSources`.
- [x] Trích dẫn nguồn trong nội dung sinh ra để tăng độ chính xác và khả năng kiểm chứng. → nhãn `[S#]` + chỉ thị trích dẫn trong prompt.
- [x] Kiểm soát ngân sách token khi nhồi ngữ cảnh (tránh vượt trần request của model). → `token-budget.ts` + gate `RAG_ACTIVATION_CHARS`. Tests: `tests/unit/rag-chunk.test.ts`, `rag-retrieve.test.ts`.

> ⚙️ Mặc định `RAG_ENABLED=false` (bật để dùng). Embedding mặc định `mock` (tất định/offline); `transformers` cần cài `@xenova/transformers`.

#### E2 · Agentic multi-step document assembly — *Smart assembly (Human-in-the-loop)*
>
> 📄 Giải thích (thiết kế): [`features/e2-agentic-assembly/explainer.md`](./features/e2-agentic-assembly/explainer.md) · ⚠️ chưa implement

- [ ] Bước 1: sinh DÀN Ý (outline) và hiển thị dạng checklist cho người dùng duyệt/sửa.
- [ ] Bước 2: tự động viết nội dung theo từng mục trong outline (multi-step), rồi ghép thành tài liệu hoàn chỉnh.
- [ ] Điểm dừng human-in-the-loop: phê duyệt / điều chỉnh giữa các bước.
- [ ] Mở rộng `lib/orchestrator/document.ts` cho quy trình nhiều bước + lưu trạng thái tiến trình.
- [ ] UI: hiển thị tiến trình checklist, chỉnh sửa từng mục (tận dụng `Marker` / chat assistant sẵn có).

#### E4 · OCR công thức Toán/Lý/Hóa — *Multimodal input*
>
> 📄 Giải thích (thiết kế): [`features/e4-formula-ocr/explainer.md`](./features/e4-formula-ocr/explainer.md) · ⚠️ chưa implement

- [ ] Nhận diện CÔNG THỨC (không chỉ text) từ ảnh → mã LaTeX (`amsmath` / `mhchem`).
- [ ] Đánh giá & tích hợp engine OCR công thức (hiện `tesseract.js` trong `lib/extract` chỉ OCR văn bản).
- [ ] Mở rộng `lib/extract` + `app/api/extract` để trả về LaTeX công thức.
- [ ] Cho người dùng review / sửa công thức nhận diện trước khi chèn vào tài liệu.

#### E6 · Prompt Engineering — *Output quality (cross-cutting)*
>
> 📄 Roadmap đầy đủ: [`features/e6-prompt-engineering/explainer.md`](./features/e6-prompt-engineering/explainer.md)
>
> **Giai đoạn 1 — Quick wins** ✅ Hoàn thành

- [x] Thêm chỉ thị "không cắt tài liệu trước `\end{document}`" → `<output_contract>` trong `SYSTEM_PROMPT`.
- [x] Tách `lib/ai/prompts.ts` thành `lib/ai/prompts/` folder module hoá: `system.ts`, `generate-latex.ts`, `repair-latex.ts`, `edit-document.ts`, `sources.ts`, `index.ts` (tương thích ngược).
- [x] Thêm `detectErrorType()` trong repair prompt: phân loại `FONT/PACKAGE/MATH/ENVIRONMENT/SYNTAX_ERROR` → gợi ý sửa cụ thể theo loại.
- [x] Thêm `<preamble_protection>` vào edit prompt: `\documentclass`, `\usepackage`, `\title` không được thay đổi khi không có yêu cầu.
- [x] Cải tiến RAG injection với XML delimiter: `<source_documents>`, `<file name="...">`, `<chunk id="S1" source="...">`.
- [x] Thêm `PROMPT_VERSION = "2025-07-v1"` constant để track regression.
- [x] Thêm `<attempt_context>` cho repair lần N > 1: "thử hướng KHÁC, đừng lặp lại".
- [x] Bổ sung **42 tests** trong `tests/unit/prompts.test.ts` bao phủ tất cả builders + `detectErrorType`.
>
> **Giai đoạn 2 — Structural improvements** (một phần ✅)

- [x] Module hoá `lib/ai/prompts/` — XML-structured prompts cho generate/repair/edit/sources.
- [ ] Chuẩn hoá cấu trúc `promptGuidance` cho tất cả 11 templates về format thống nhất (`lib/templates/registry.ts`).
- [ ] Thiết kế prompt cho E2 Agentic assembly: `generate-outline.ts`, `generate-section.ts`.
- [ ] Structured output schema cho outline/diagnosis dùng `generateObject()` (`lib/ai/schemas/`).
- [ ] Thêm `promptVersion` vào response metadata để debug theo từng request.
>
> **Giai đoạn 3 — Evaluation & Versioning** 🔲 **(P0 — làm tiếp theo, trước E7; stack đã verify)**
> 📄 Chi tiết dataset/metrics/kiến trúc: mục 4.3 trong [`explainer.md`](./features/e6-prompt-engineering/explainer.md)
> 🧪 Spike (đã xong 2026-07-13): [`spike-promptfoo-integration.md`](./features/e6-prompt-engineering/spike-promptfoo-integration.md) — Promptfoo custom TS provider chạy được (`moduleResolution: bundler` + `@/*`), custom scorer tái dùng `validateLatex()` thật hoạt động đúng; **không cần workaround**.

- [x] Spike verify Promptfoo custom TS provider + custom scorer khả thi trong project.
- [ ] Tạo `lib/prompt-eval/` (ngang hàng `lib/ai/`, KHÔNG lồng trong đó) — platform-level cho eval,
      tách khỏi code production.
- [ ] Tạo `lib/prompt-eval/datasets/global/` — 5–10 case an toàn/output-contract/unicode, dùng lại
      được cho mọi template (không riêng `math`).
- [ ] Tạo `lib/prompt-eval/datasets/math/` — 14 case theo domain (simple-equation, theorem-proof,
      multiple-theorems, matrices, cases, aligned-derivation, calculus, vietnamese-math,
      vague-request, conflicting-request, unsupported-package, undefined-command,
      adversarial-input, step-by-step-solution).
- [ ] Tạo `lib/prompt-eval/scorers/` — custom `javascript` assertion cho Promptfoo, tái dùng
      `validateLatex()` + các check con đã có ở E6 Bước 2 (KHÔNG viết lại logic).
- [ ] Tạo `lib/prompt-eval/providers/math-provider.ts` — provider thật (quyết định gọi
      `runDocument()` đầy đủ có compile Tectonic hay chỉ `provider.generate()`).
- [ ] So sánh Math Template v1 (trước E6 Bước 1) vs v2 (hiện tại) trên cùng dataset qua
      `npx promptfoo eval` → baseline number cụ thể + xác nhận không regression ở case cũ.
- [ ] Xây dựng A/B test framework với `PROMPT_VARIANT` env var (multi-provider config Promptfoo).
- [ ] Tạo `docs/features/e6-prompt-engineering/changelog.md` — mỗi lần tăng `PROMPT_VERSION` kèm
      một entry log kết quả đo.

#### E7 · Clarification Layer — *Request understanding (human-in-the-loop, trước generate)*
>
> 📄 Giải thích (thiết kế): [`features/e7-clarification-layer/explainer.md`](./features/e7-clarification-layer/explainer.md) · ⚠️ chưa implement
>
> **Chưa bắt đầu — cần 2 điều kiện trước khi cam kết effort L:**
>
> 1. **Eval baseline của E6 Giai đoạn 3** phải hoàn thành trước (đo compile rate/repair attempts hiện
>    tại) — nếu không có baseline, không thể chứng minh Clarification Layer thực sự cải thiện gì.
> 2. **Eval data thực tế** cho thấy tỉ lệ request mơ hồ dẫn tới chất lượng kém là vấn đề đáng kể
>    (tương tự nguyên tắc đã áp dụng khi defer `MathGenerationPlan`/`MathDocumentMode` ở E6: chờ
>    chứng minh cần thiết bằng dữ liệu thực tế trước khi implement, tránh over-engineer khi chưa có
>    consumer thực tế).
>
- [ ] **Bước 0 (trước implement):** thu thập eval data — đo tỉ lệ request mơ hồ hiện tại dẫn tới tài
      liệu cần chat-edit sửa lại do sai ý định ban đầu. Chỉ tiếp tục các bước dưới nếu số liệu cho
      thấy đây là vấn đề đáng kể.
- [ ] Định nghĩa schema `RequestPlan` (structured output qua `generateObject()`): `intent`,
      `templateId`, `requirements`, `assumptions`, `missingInformation`, `ambiguity`, `confidence`,
      `recommendedAction` (`"generate" | "clarify"`).
- [ ] Thiết kế `ClarificationPolicy` (module code riêng, KHÔNG để AI tự quyết định): áp dụng 3 cấp độ
      rõ ràng — Level 1 (không hỏi, dùng default), Level 2 (hỏi optional, có nút bỏ qua), Level 3
      (bắt buộc hỏi, block generate).
- [ ] Định nghĩa tool `askUserQuestion` dùng chung (schema Zod: `question`/`reason`/`type`
      `single_choice|multiple_choice|free_text`/`options`/`allowCustomAnswer`/`required`) — MỘT tool
      cho mọi template, không tạo tool riêng theo từng domain.
- [ ] Mở rộng `lib/templates/registry.ts`: thêm field `clarificationFields?: ClarificationField[]`
      cho mỗi template (dimension quan trọng, critical/optional, predefined question, default nếu bỏ
      qua) — theo pattern đã dùng cho `capabilities`/`repairHints` ở E6.
- [ ] Thêm bước `understandRequest()` trong `lib/orchestrator/document.ts`, chạy TRƯỚC generate ở mọi
      entrypoint (`runDocument`/`runDocumentFromMarkdown`/`runEdit`) — không đổi `runRepairLoop`.
- [ ] Mở rộng SSE lifecycle: thêm state `understanding` và `awaiting_user_input` (giữa `generating`
      hiện tại) trong `app/api/documents/route.ts` (và route edit/project tương ứng) + endpoint resume
      nhận câu trả lời người dùng.
- [ ] UI: component render câu hỏi theo `type` (chọn 1 / chọn nhiều / nhập tự do), luôn có lựa chọn
      "Bỏ qua và tạo luôn" khi `required: false`.
- [ ] Giới hạn cứng số câu hỏi mỗi lượt + tổng số lượt clarify mỗi request (né over-clarification và
      vòng lặp vô hạn).
- [ ] Kiểm thử: `RequestPlan` cho các case rõ ràng/mơ hồ/thiếu critical field; `ClarificationPolicy`
      cho 3 cấp độ; resume flow merge câu trả lời đúng vào request context.

### ⚪ Phase 3 — Platform Maturity

#### Authentication & Database (v2)

- [ ] Multi-user Auth: đăng nhập, quản lý phiên, phân quyền.
- [ ] Chuyển lưu trữ từ file-based (`DATA_DIR`) sang Database (Postgres hoặc Mongo).
- [ ] Tách dữ liệu theo người dùng (ownership / authorization).
- [ ] Lớp migration dữ liệu từ file-based sang DB.

#### Advanced deployment strategies

- [ ] Hoàn thiện Dockerization (đã có `Dockerfile`, `docker-compose.yml`, `Caddyfile`).
- [ ] Thiết lập CI/CD pipeline (build + lint + test + deploy).
- [ ] Triển khai Cloud + cấu hình TLS/domain qua Caddy cho production.
- [ ] Healthcheck / logging / observability cho môi trường production.

---

> **Chú thích trạng thái:**
>
> - ✅ `Done`: Hoàn thành
> - 🔄 `In Progress`: Đang xử lý
> - 🔲 `Todo`: Chưa bắt đầu
> - ❌ `Cancelled / Blocked`: Bị hủy hoặc tạm dừng
