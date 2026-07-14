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
| 🔄 | **E6 · Prompt Engineering** | Cải thiện hệ thống prompt toàn dự án: system prompt, repair/edit prompt, per-template guidance, RAG injection, đo lường chất lượng. | Theme: Output quality · Ưu tiên **3** (cross-cutting) · Effort M · Giai đoạn 1–2 ✅, Giai đoạn 3 🔄 (baseline eval đã chạy) |
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
> **Giai đoạn 3 — Evaluation & Versioning** 🔄 **(4 P0 đã implement — 9/14 → 12/14 PASS, xem changelog.md)**
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
- [ ] **(Còn lại)** `pass@k`/eval nhiều lần (Promptfoo `repeat` config) để đo flaky rate; nối provider
      eval với `runRepairLoop()` thật để đo Recovery success; chạy `compile-success.ts` với
      `compile-service` thật để đo Final compile success đúng nghĩa (PDF thật); tách
      `CapabilityAlternative[]` thành cấu trúc dữ liệu riêng khi cần thêm cho template khác.

#### E7 · Clarification Layer — *Request understanding (human-in-the-loop, trước generate)*
>
> 📄 Giải thích (thiết kế): [`features/e7-clarification-layer/explainer.md`](./features/e7-clarification-layer/explainer.md) · ⚠️ chưa implement
>
> **Chưa bắt đầu — 1/2 điều kiện đã đáp ứng, còn 1 điều kiện cần dữ liệu thực tế:**
>
> 1. ✅ **Eval baseline của E6 Giai đoạn 3 đã hoàn thành** (2026-07-13, xem
>    [`e6-prompt-engineering/changelog.md`](./features/e6-prompt-engineering/changelog.md)) — Math
>    template v2 đo được **12/14 PASS (85.71%)** trên AI thật sau 4 fix P0. Có baseline để so sánh.
> 2. 🔲 **Eval data thực tế** cho thấy tỉ lệ request mơ hồ dẫn tới chất lượng kém là vấn đề đáng kể
>    (tương tự nguyên tắc đã áp dụng khi defer `MathGenerationPlan`/`MathDocumentMode` ở E6: chờ
>    chứng minh cần thiết bằng dữ liệu thực tế trước khi implement, tránh over-engineer khi chưa có
>    consumer thực tế) — **vẫn chưa có, cần làm Bước 0 dưới đây trước khi tiếp tục.**
>
- [ ] **Bước 0 (trước implement):** thu thập eval data — đo tỉ lệ request mơ hồ hiện tại dẫn tới tài
      liệu cần chat-edit sửa lại do sai ý định ban đầu. Chỉ tiếp tục các bước dưới nếu số liệu cho
      thấy đây là vấn đề đáng kể.
- [ ] Định nghĩa schema `RequestPlan` (structured output qua `generateObject()`): `intent`,
      `templateId`, `requirements`, `assumptions`, `missingInformation`, `ambiguity`, `confidence`,
      `recommendedAction` (`"generate" | "clarify"`).
- [ ] Thiết kế `ClarificationPolicy` (module code riêng, KHÔNG để AI tự quyết định): áp dụng **2
      quyết định độc lập** (đã thách thức lại "3 cấp độ" ban đầu và sửa 2026-07-14, xem mục 3.2 của
      explainer.md) — Quyết định A ở tầng request (`recommendedAction`: hỏi hay không) + Quyết định B
      ở tầng từng field bị thiếu (`importance` → `required`: bắt buộc hay có thể bỏ qua). Một request
      có thể có đồng thời field `critical` và `optional`, không ép vào một "cấp độ" duy nhất.
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
      cho cả 2 quyết định độc lập (bao gồm case field hỗn hợp critical+optional cùng lúc); resume
      flow merge câu trả lời đúng vào request context.

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
