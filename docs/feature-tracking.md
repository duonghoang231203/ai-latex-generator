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
| ⏸️ | **E1 · Multi-file project support (Core)** `#deferred` | Kiến trúc lưu trữ dạng thư mục (Directory-based storage) phục vụ tài liệu lớn. Nền đã có (data model, compile-service, `runProject()`); **tạm dừng tiếp tục** — chờ ưu tiên lại. | Theme: Scale · Ưu tiên **1** (enabler) · Effort L |
| ✅ | **E5 · Markdown → LaTeX conversion** | Viết nháp bằng định dạng Markdown, tự động chuyển sang chuẩn LaTeX. | Theme: Authoring speed · Ưu tiên **2** (quick win) · Effort S–M · **Done** |
| ✅ | **E3 · RAG (Retrieval-Augmented Generation)** | Truy hồi tài liệu tham khảo (upload) để AI viết nội dung chính xác, có trích dẫn nguồn. | Theme: Content accuracy · Ưu tiên **3** · Effort M–L · **Done** (mặc định tắt: `RAG_ENABLED`) |
| 🔲 | **E2 · Agentic multi-step document assembly** `#later` | Cơ chế tạo dàn ý và tự động viết nội dung theo dạng Checklist (Human-in-the-loop). | Theme: Smart assembly · Ưu tiên **4** (sau E1) · Effort L |
| 🔲 | **E4 · OCR công thức Toán/Lý/Hóa** `#later` | Nhận diện công thức Toán/Lý/Hóa từ hình ảnh thành mã LaTeX. | Theme: Multimodal input · Ưu tiên **5** · Effort M |
| 🔄 | **E6 · Prompt Engineering** | Cải thiện hệ thống prompt toàn dự án: system prompt, repair/edit prompt, per-template guidance, RAG injection, đo lường chất lượng. | Theme: Output quality · Ưu tiên **3** (cross-cutting) · Effort M · Giai đoạn 1 ✅, Giai đoạn 2 một phần ✅ (còn lại `#later`), Giai đoạn 3 🔄 (12/14 PASS AI thật, còn lại `#later`) |
| ✅ | **E7 · Clarification Layer** `#flag-off` | Bước hiểu yêu cầu (Request Understanding) trước generate: sinh `RequestPlan` có cấu trúc, code quyết định generate ngay hay hỏi lại qua tool `askUserQuestion` dùng chung toàn app. **Toàn bộ đã code+test 2026-07-14** (end-to-end đã verify bằng integration test thật), nhưng nằm sau `CLARIFICATION_ENABLED=false` (mặc định) — chưa bật cho user thật, chưa có eval data đo tần suất thật ngoài eval set nhỏ dùng để test. | Theme: Request understanding · Ưu tiên **6** · Effort L |

---

## ⚪ Phase 3: Platform Maturity (Kế hoạch tương lai)

| Trạng thái | Tính năng | Mô tả chi tiết |
| :---: | :--- | :--- |
| 🔄 | **Authentication & Database (v2)** | Multi-user Auth qua Supabase (đăng nhập, session, RLS theo `owner_id`) + lưu trữ Postgres qua `STORE_BACKEND=supabase` — **đã implement cho document CRUD**. Còn thiếu: `middleware.ts` tập trung (hiện gate quyền tại từng route/component, chưa có 1 lớp middleware chung), workspace/project ownership (multi-user cho E1 multi-file), migration dữ liệu cũ từ file-based sang Postgres. |
| 🔲 | **Advanced deployment strategies** | Triển khai trên môi trường Cloud, Dockerization, thiết lập CI/CD pipeline. |

---

## 📋 Task Breakdown (trích xuất từ Roadmap)

Các đầu việc cụ thể được trích xuất từ [`project-roadmap.md`](./project-roadmap.md) cho từng tính năng. Dùng để theo dõi tiến độ chi tiết (đánh dấu `[x]` khi hoàn thành từng đầu việc). Các epic Phase 2 được sắp theo **thứ tự ưu tiên của roadmap: E1 → E5 → E3 → E2 → E4 → E6 (song song, cross-cutting) → E7 (sau E6, cần eval data)**.

### 🟡 Phase 2 — Advanced Features

#### E1 · Multi-file project support (Core) — *Scale* `#deferred`
>
> ⏸️ **TẠM DỪNG (2026-07-14)** — nền tảng đã có (data model, compile-service path-guard,
> `runProject()` ở orchestrator), nhưng chưa tiếp tục các phần còn thiếu (UI, wiring vào luồng tạo
> tài liệu thật). Giữ nguyên trạng thái hiện tại, không phát triển thêm cho tới khi được ưu tiên
> lại — không xoá vì phần đã làm vẫn hoạt động và có test bao phủ.
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

#### E2 · Agentic multi-step document assembly — *Smart assembly (Human-in-the-loop)* `#later`
>
> 📄 Giải thích (thiết kế): [`features/e2-agentic-assembly/explainer.md`](./features/e2-agentic-assembly/explainer.md) · ⚠️ chưa implement

- [ ] Bước 1: sinh DÀN Ý (outline) và hiển thị dạng checklist cho người dùng duyệt/sửa.
- [ ] Bước 2: tự động viết nội dung theo từng mục trong outline (multi-step), rồi ghép thành tài liệu hoàn chỉnh.
- [ ] Điểm dừng human-in-the-loop: phê duyệt / điều chỉnh giữa các bước.
- [ ] Mở rộng `lib/orchestrator/document.ts` cho quy trình nhiều bước + lưu trạng thái tiến trình.
- [ ] UI: hiển thị tiến trình checklist, chỉnh sửa từng mục (tận dụng `Marker` / chat assistant sẵn có).

#### E4 · OCR công thức Toán/Lý/Hóa — *Multimodal input* `#later`
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
> **Giai đoạn 2 — Structural improvements** (một phần ✅, phần còn lại `#later`)

- [x] Module hoá `lib/ai/prompts/` — XML-structured prompts cho generate/repair/edit/sources.
- [x] ~~Chuẩn hoá cấu trúc `promptGuidance` cho tất cả 11 templates~~ — **đã sửa số liệu sai
      2026-07-14**: `TemplateId` (`lib/types/document.ts`) chỉ có **4 giá trị thật**
      (`academic`/`math`/`thesis`/`slides`), `TEMPLATES` là `Record<TemplateId, DocumentTemplate>`
      nên không thể có 11 entry — "11" bị chép nhầm từ mô tả sản phẩm ban đầu
      (`project-overview-pdr.md`: "reports, academic, math/physics/chemistry, engineering, thesis,
      Beamer, letters/CVs, exams") mà không verify lại với code. 4 template hiện có đã được chuẩn
      hoá đủ (schema 5-field cố định, xem `DocumentTemplate.promptGuidance` trong `registry.ts`).
- [ ] **`#later` — Task bàn giao: Mở rộng 7 template mới** (epic riêng, KHÔNG phải "chuẩn hoá" — đây
      là thêm `TemplateId` mới, effort ước tính tương đương thêm 1 template = ~0.5–1 ngày/template
      nếu theo đúng pattern 4 template hiện có). Xem chi tiết đầy đủ (phạm vi kỹ thuật, checklist per
      template, thứ tự làm đề xuất) tại
      [`docs/backend-roadmap.md` § Phase 6](./backend-roadmap.md#-phase-6-mở-rộng-template-tag-later).
      7 template cần thêm, theo đúng ý định sản phẩm ban đầu:
      `report`, `physics`, `chemistry`, `engineering`, `letter`, `cv`, `exam`.
- [ ] `#later` Thiết kế prompt cho E2 Agentic assembly: `generate-outline.ts`, `generate-section.ts`.
- [ ] `#later` Structured output schema cho outline/diagnosis dùng `generateObject()` (`lib/ai/schemas/`).
- [ ] `#later` Thêm `promptVersion` vào response metadata để debug theo từng request.
>
> **Giai đoạn 3 — Evaluation & Versioning** `#later` 🔄 **(4 P0 đã implement — 9/14 → 12/14 PASS, xem changelog.md)**
> 📄 Chi tiết dataset/metrics/kiến trúc: mục 4.3 trong [`explainer.md`](./features/e6-prompt-engineering/explainer.md)
> 🧪 Spike (đã xong 2026-07-13): [`spike-promptfoo-integration.md`](./features/e6-prompt-engineering/spike-promptfoo-integration.md) — Promptfoo custom TS provider chạy được (`moduleResolution: bundler` + `@/*`), custom scorer tái dùng `validateLatex()` thật hoạt động đúng; **không cần workaround**.
> 📈 Changelog: [`changelog.md`](./features/e6-prompt-engineering/changelog.md) — 4 entry: baseline Mock (40/40) → AI thật lần 1 (4/14, phát hiện bug `polyglossia`) → sau fix polyglossia (9/14) → **sau 4 P0 finishReason/truncation-recovery/positive-alternative (12/14, 85.71%)**.

- [x] Spike verify Promptfoo custom TS provider + custom scorer khả thi trong project.
- [x] Tạo `lib/prompt-eval/` (ngang hàng `lib/ai/`, KHÔNG lồng trong đó) — platform-level cho eval,
      tách khỏi code production.
- [x] Tạo `lib/prompt-eval/datasets/global/` — 6 case an toàn/output-contract/unicode, dùng lại
      được cho mọi template (không riêng `math`).
- [x] Tạo `lib/prompt-eval/datasets/math/` — 14 case theo domain (simple-equation, theorem-proof,
      multiple-theorems, matrices, cases, aligned-derivation, calculus, vietnamese-math,
      vague-request, conflicting-request, unsupported-package, undefined-command,
      adversarial-input, step-by-step-solution).
- [x] Tạo `lib/prompt-eval/scorers/` — `validate-latex.ts` (tái dùng `validateLatex()` thật, tự lấy
      `packageAllowlist`/`knownTheoremEnvironments` theo `vars.templateId` — KHÔNG hardcode) +
      `compile-success.ts` (gọi Tectonic thật qua `compileLatex()`, không block eval khi
      `compile-service` không chạy).
- [x] Tạo `lib/prompt-eval/providers/math-provider.ts` — hỗ trợ 2 version: `v1` (trích xuất Y
      NGUYÊN từ git commit `2bc62faa1` — bản trước khi viết lại ở Bước 1) và `v2` (gọi
      `renderTemplateLatex()` thật từ registry hiện tại). Version chọn qua `config.version` hoặc
      env var `PROMPT_VARIANT`.
- [x] So sánh Math Template v1 vs v2 trên cùng dataset qua `npx promptfoo eval` → **baseline: 40/40
      PASS (100%)**. Insight quan trọng: dataset ban đầu (dùng `MockProvider`) chưa có case đủ
      "khắc nghiệt" để phân biệt chất lượng 2 version — **đã bổ sung ngay trong cùng ngày**: scorer
      `theorem-env-coverage.ts` xác nhận CÓ CHỦ ĐÍCH v2 có `corollary`/`example` (v1 không có,
      verify bằng cách đọc trực tiếp registry.ts hiện tại + `git show 2bc62faa1`). Xem `changelog.md`.
- [x] Xây dựng A/B test framework với `PROMPT_VARIANT` env var — đã có trong `math-provider.ts`
      constructor (đọc `config.version` trước, fallback `process.env.PROMPT_VARIANT`).
- [x] Tạo `docs/features/e6-prompt-engineering/changelog.md` — 2 entry: baseline đầu tiên + bổ sung
      "khác biệt có chủ đích" (`theorem-env-coverage` scorer) trong cùng ngày.
- [ ] **(Chưa làm — để lần đo tiếp theo)** Đổi provider sang gọi AI thật (`VercelAiProvider`) cho
      case ambiguity/adversarial + chạy `compile-success.ts` scorer với `compile-service` thật
      đang chạy. (Đã bỏ khỏi phạm vi "chưa làm": case dataset khác biệt có chủ đích — đã làm ở trên.)
- [x] **Đã dùng AI thật (`math-real-ai-provider.ts`, gọi `getProvider()` factory + `.env` thật):**
      lần đầu đo 4/14 PASS (28.57%) → phát hiện root cause **bug cross-cutting** trong
      `SYSTEM_PROMPT` (khuyến nghị `polyglossia` mâu thuẫn với `packageAllowlist` của MỌI template)
      → fix `<font_rules>` trong `lib/ai/prompts/system.ts`, tăng `PROMPT_VERSION` lên
      `"2026-07-v2"` → đo lại: **9/14 PASS (64.29%)**, 0 lần lỗi `polyglossia`. Xem `changelog.md`.
- [x] **Implement 4 P0 theo phân loại lỗi (generation truncation / constraint enforcement /
      structural consistency) — KHÔNG tiếp tục kéo dài `promptGuidance` mù quáng:**
  - [x] `finishReason`-aware generation — `LatexProvider.generate()` trả `GenerateOutcome`
        (`finishReason`/`rawFinishReason`/`usage`), `VercelAiProvider` đọc thật từ
        `generateText()`/`streamText()` (`ai@7.0.19`).
  - [x] Truncation recovery **TÁCH BIỆT hoàn toàn khỏi `runRepairLoop`** (compile error ≠
        incomplete generation) — helper `generateWithTruncationRecovery()` export từ
        `lib/orchestrator/document.ts`, thay 8 điểm gọi `deps.provider.generate()` trực tiếp.
        Verified bằng test mới `tests/unit/orchestrator-truncation.test.ts`.
  - [x] Positive alternative cho capability bị cấm (`hyperref`/`tikz`) trong `promptGuidance` của
        `math` — theo đúng khuyến nghị chính thức Anthropic ("tell what to do instead of what not
        to do"), thay negative-only instruction.
  - [x] Verify `checkBrokenReferences()` (đã có từ Bước 2) đúng logic, không cần viết lại.
- [x] **Đo lại bằng AI thật sau 4 P0 (2 lần chạy độc lập):** cả 2 lần đều **12/14 PASS (85.71%)**
      — tăng từ 9/14. Phát hiện + fix ngay 1 gap: provider eval ban đầu KHÔNG dùng
      `generateWithTruncationRecovery()` (chỉ orchestrator có) → đã export helper + sửa provider
      eval dùng lại, tránh eval đo sai hành vi so với app thật.
  - **Bằng chứng non-determinism thật (không suy đoán):** 2 lần chạy cùng 12/14 nhưng **case fail
    khác nhau hoàn toàn** (`hyperref`+cắt cụt lần 1 → `\usepackage{vietnam}`+`tikz`/`pgfplots`/`axis`
    lần 2) — xác nhận đúng cảnh báo "model vẫn có tính xác suất, không nên đảm bảo 14/14 ổn định".
  - **4 metrics đo được (số liệu thật, không phải ví dụ):** Prompt compliance 12/14, Violation
    detection 2/2 (không có false negative), Recovery success CHƯA ĐO (eval chưa nối `runRepairLoop`),
    Final compile success CHƯA ĐO (`compile-success.ts` scorer chưa chạy với `compile-service` thật).
    Xem chi tiết đầy đủ + giải thích gap giữa "prompt compliance" và "final success" hiện trùng
    nhau: `changelog.md`.
- [ ] `#later` **(Còn lại)** `pass@k`/eval nhiều lần (Promptfoo `repeat` config) để đo flaky rate;
      nối provider eval với `runRepairLoop()` thật để đo Recovery success; chạy `compile-success.ts`
      với `compile-service` thật để đo Final compile success đúng nghĩa (PDF thật); tách
      `CapabilityAlternative[]` thành cấu trúc dữ liệu riêng khi cần thêm cho template khác.

#### E7 · Clarification Layer — *Request understanding (human-in-the-loop, trước generate)* `#flag-off`
>
> 📄 Giải thích (thiết kế + toàn bộ lịch sử implementation/redesign): [`features/e7-clarification-layer/explainer.md`](./features/e7-clarification-layer/explainer.md)
>
> ⚠️ **Sửa mâu thuẫn tài liệu (2026-07-15):** block dưới đây trước ghi "Chưa bắt đầu — chờ eval
> data" — SAI, không khớp với dòng tổng quan E7 ở đầu file này (đã ghi đúng "Toàn bộ đã code+test").
> Thực tế: **user đã chủ động yêu cầu implement ngay, không đợi Bước 0/eval data** — quyết định
> giống nguyên tắc "chờ chứng minh cần thiết" đã áp dụng ở E6, nhưng ở đây user chọn ngược lại có
> chủ đích. Đã code xong Nhóm A (Request Understanding) + Nhóm B (SSE lifecycle/UI resume), rồi
> qua **2 lần redesign** dựa trên phản hồi thật khi dùng: lần 1 sửa bug TTL (thêm countdown), lần 2
> **đổi hẳn kiến trúc session** (bỏ Promise-treo-trong-RAM, lưu bền Postgres/file, đóng SSE ngay
> khi hỏi, resume qua request độc lập hoàn toàn — xem § 6.7 của explainer.md). TTL hiện tại **24
> giờ** (tăng từ 5 phút ban đầu, theo yêu cầu 2026-07-15). Checklist dưới đây giữ nguyên để tham
> chiếu lịch sử, đánh dấu lại đúng theo trạng thái code thật (không suy đoán).
>
- [x] ~~Bước 0 (trước implement): thu thập eval data~~ — **đã BỎ QUA có chủ đích theo yêu cầu
      user**, không phải đã làm. Vẫn CHƯA có eval data thực tế đo tần suất `awaiting_user_input`
      trong sử dụng thật — lý do duy nhất tính năng còn nằm sau `CLARIFICATION_ENABLED=false`.
- [x] Định nghĩa schema `RequestPlan` — `lib/clarification/understand-request.ts` +
      `lib/ai/prompts/understand-request.ts`, dùng `generateObject()` đúng như thiết kế.
- [x] Thiết kế `ClarificationPolicy` (2 quyết định độc lập, request-level + field-level) — code
      trong `maybeClarify()` (`app/api/documents/route.ts`) + `clarificationFields` per-template.
- [x] Định nghĩa tool/schema `askUserQuestion` dùng chung — `PendingQuestion` type, MỘT schema cho
      mọi template, không tạo riêng theo domain.
- [x] Mở rộng `lib/templates/registry.ts`: `clarificationFields?: ClarificationField[]` — đã thêm
      cho template `math` (ví dụ tham chiếu theo đúng mục 3.5 explainer.md).
- [x] Thêm bước hiểu request TRƯỚC generate — `maybeClarify()` chạy trong nhánh SSE của
      `app/api/documents/route.ts`, KHÔNG đổi `runRepairLoop`.
- [x] SSE lifecycle — **đã đổi khác thiết kế ban đầu qua redesign § 6.7**: không còn state
      `understanding`/`awaiting_user_input` *trong cùng 1 kết nối đang mở* — SSE **đóng ngay** khi
      cần hỏi, resume qua route hoàn toàn mới
      (`app/api/documents/clarify/[jobId]/resume/route.ts`) mở **SSE mới**, không phải "tiếp tục".
- [x] UI: `components/ClarificationQuestionForm.tsx` — render theo `type`, luôn có lựa chọn bỏ qua
      khi `!required`. (Countdown/`expiresAt` UI đã thêm ở redesign lần 1, rồi **bỏ lại hoàn toàn**
      ở redesign lần 2 vì không còn khớp kiến trúc mới — xem § 6.6 vs § 6.7.)
- [ ] Giới hạn cứng số câu hỏi mỗi lượt + tổng số lượt clarify mỗi request — **CHƯA làm**, không
      nằm trong phạm vi 2 lần redesign đã qua (mỗi request hiện tại chỉ hỏi tối đa 1 vòng, chưa có
      giới hạn tường minh nào chặn nhiều vòng liên tiếp nếu về sau mở rộng cho phép clarify nhiều
      lần).
- [x] Kiểm thử — 22 test hiện tại (7 unit session-store + 9 unit form + 6 integration end-to-end
      thật) bao phủ: RequestPlan rõ ràng/mơ hồ, resume qua route độc lập, double-resume (409),
      resume sai `jobId` (404), lazy expiry, generate path không đổi, flag off không gọi AI.


### ⚪ Phase 3 — Platform Maturity

#### Authentication & Database (v2) 🔄 *(một phần đã implement — xem ghi chú)*

> ⚠️ **Đã sửa mâu thuẫn 2026-07-14:** mục này trước đây ghi 🔲 Todo hoàn toàn, nhưng đọc code thật
> (`lib/auth/current-user.ts`, `lib/store/supabase-document-store.ts`,
> `supabase/migrations/0001_documents.sql`, `app/login/`, `app/auth/callback/`) xác nhận phần CRUD
> tài liệu qua Supabase **đã implement và hoạt động**, không phải kế hoạch tương lai. `README.md` đã
> phản ánh đúng điều này. Danh sách dưới đây cập nhật lại theo trạng thái thật.

- [x] Multi-user Auth qua Supabase: đăng nhập (`app/login/page.tsx` + `login-form.tsx`), callback
      OAuth (`app/auth/callback/route.ts`), đọc session server-side
      (`lib/auth/current-user.ts` → `getCurrentUser()`/`getCurrentUserId()`).
- [x] Lưu trữ trên Database (Postgres qua Supabase): `lib/store/supabase-document-store.ts` implement
      đủ CRUD (`createDocument`/`getDocument`/`listDocuments`/`updateDocument`/`appendMessages`/
      `deleteDocument`), chọn qua `STORE_BACKEND=supabase` trong facade `documentStore.ts`
      (mặc định vẫn `file`, không đổi behavior khi không set).
- [x] Migration schema: `supabase/migrations/0001_documents.sql` — bảng `documents` ánh xạ 1-1
      `StoredDocument`, cột suy diễn `has_pdf` (tránh kéo `pdf_base64` nặng khi list), trigger
      `set_updated_at`, index theo `(owner_id, updated_at desc)`.
- [x] Tách dữ liệu theo người dùng (ownership/authorization): **RLS đầy đủ 4 policy**
      (select/insert/update/delete, tất cả `using (auth.uid() = owner_id)`), `owner_id` là cột
      `not null references auth.users(id) on delete cascade` — không thể tạo document không có chủ.
- [ ] **Middleware tập trung** (`middleware.ts` ở root) — hiện CHƯA có; việc gate quyền đang nằm rời
      rạc ở từng route/component (route Supabase tự chặn qua RLS ở tầng DB, nhưng chưa có 1 lớp
      kiểm tra session sớm/redirect thống nhất ở tầng Next.js middleware).
- [ ] **Ownership cho multi-file project (E1)** — RLS hiện chỉ áp cho bảng `documents` (single-doc
      CRUD); chưa có khái niệm workspace/project multi-user khi E1 UI thật được wiring.
- [ ] Lớp migration dữ liệu: chuyển tài liệu ĐÃ TỒN TẠI trên `file` backend (JSON trong `DATA_DIR`)
      sang Postgres — hiện 2 backend độc lập, không tự động đồng bộ/migrate qua nhau.

#### Advanced deployment strategies `#later`

- [ ] Hoàn thiện Dockerization (đã có `Dockerfile`, `docker-compose.yml`, `Caddyfile`).
- [ ] Thiết lập CI/CD pipeline (build + lint + test + deploy).
- [ ] Triển khai Cloud + cấu hình TLS/domain qua Caddy cho production.
- [ ] Healthcheck / logging / observability cho môi trường production — **chi tiết đầy đủ (2026-07-14,
      8 task con BE-5.3.1–5.3.8) đã viết tại
      [`docs/backend-roadmap.md` § BE-5.3](./backend-roadmap.md#-phase-5-cicd--devops-platform-maturity)**,
      bao gồm bối cảnh phát hiện thật (không debug được vấn đề E7 do thiếu log) và audit privacy
      cần làm trước khi thêm Sentry SDK.

---

> **Chú thích trạng thái:**
>
> - ✅ `Done`: Hoàn thành
> - 🔄 `In Progress`: Đang xử lý
> - 🔲 `Todo`: Chưa bắt đầu
> - ❌ `Cancelled / Blocked`: Bị hủy hoặc tạm dừng
