# Codebase Summary

## 1. High-Level Structure
- **`app/`**: Next.js App Router — chỉ chứa route/page (`page.tsx`, `layout.tsx`, `login/`,
  `auth/callback/`, `documents/[id]/`) và API routes (`app/api/{generate,extract,compile,
  documents,document,health}/`). Không còn chứa UI component (đã tách ra `components/`).
- **`components/`**: Toàn bộ React UI component dùng chung (`ChatAssistant`, `DocumentWorkspace`,
  `DocumentList`, `GeneratorForm`, `TemplateSelect`, `ResultPanel`, `AuthStatus`,
  `theme-provider`...) + `components/ui/` (shadcn/ui primitives: `button`, `dropdown-menu`,
  `input`, `menubar`...). Có `components/__tests__/` riêng cho component test.
- **`compile-service/`** (~600 files gồm tests/dependencies): sandboxed Node.js service chạy
  Tectonic, có Dockerfile để cô lập.
- **`lib/`**: business logic của Next.js app, chia theo domain:
  - `ai/`: providers (`vercel-provider.ts`, `mock.ts`, `factory.ts`) + `ai/prompts/` (đã module
    hóa từ 1 file `prompts.ts` duy nhất thành `system.ts`, `generate-latex.ts`,
    `edit-document.ts`, `repair-latex.ts`, `sources.ts`, `index.ts` — mỗi file phụ trách 1 loại
    prompt) + `ai/embedding-*.ts` (embedding cho RAG).
  - `orchestrator/`: vòng lặp self-healing generate → validate → compile → repair
    (`document.ts` — bao gồm `generateWithTruncationRecovery()` xử lý generation bị cắt cụt
    TÁCH BIỆT khỏi repair loop; `deps.ts`, `truncateLog.ts`).
  - `validation/`: kiểm cấu trúc LaTeX trước khi compile (`validate.ts` — package allowlist,
    theorem environment, broken cross-reference...; `input.ts` — validate input người dùng).
  - `templates/`: `registry.ts` — định nghĩa 4 template (`academic`, `math`, `thesis`, `slides`)
    với `promptGuidance`/`packageAllowlist`/`repairHints` riêng từng template.
  - `compile/`: client gọi `compile-service` (`client.ts`, `project-path.ts`).
  - `store/`: tầng lưu trữ tài liệu — hỗ trợ cả file-based (`file-document-store.ts`,
    `documentStore.ts`) và Supabase (`supabase-document-store.ts`), cùng `project-document.ts`
    cho multi-file project.
  - `auth/`: `current-user.ts` — đọc user hiện tại từ Supabase session.
  - `rag/`: retrieval-augmented generation cho nguồn tham khảo người dùng upload (chunking,
    vector store, MMR, embedding cache, token budget).
  - `markdown/`: chuyển Markdown → LaTeX (parser, emitter, escape).
  - `extract/`, `ratelimit/`: trích xuất input đa dạng (PDF/DOCX/ảnh...) và giới hạn tốc độ API.
  - `prompt-eval/`: **platform đánh giá chất lượng prompt/template** (Promptfoo), tách biệt
    hoàn toàn khỏi code production — `datasets/` (test case theo domain), `providers/` (gọi
    MockProvider hoặc AI thật qua orchestrator), `scorers/` (custom assertion tái dùng
    `validateLatex()`/compile thật), `results/` (báo cáo `.md` từ các lần đo AI thật),
    `promptfooconfig{,.real-ai}.yaml`.
  - `config.ts`, `log.ts`, `utils.ts`: cấu hình, logging, helper chung.
- **`lib/types/`**, **`types/`**: định nghĩa TypeScript toàn cục (`document.ts`).
- **`specs/`**: đặc tả tính năng theo spec-kit (ví dụ `001-latex-document-generation`).

## 2. Key Workflows
- **Generation Flow**: UI (`components/`) → Next.js API route (streaming SSE trạng thái) →
  `lib/orchestrator` → `generateWithTruncationRecovery()` (đảm bảo output không bị cắt cụt giữa
  đường trước khi validate) → AI Provider → `lib/validation` (kiểm cấu trúc) → `compile-service`
  → PDF response.
- **Repair Flow**: nếu `validateLatex()` hoặc `compile-service` báo lỗi (trên một document ĐÃ
  HOÀN CHỈNH), orchestrator parse lỗi và yêu cầu AI sửa tối thiểu, lặp tối đa `maxAttempts` lần.
  Lưu ý: truncation (generation CHƯA HOÀN THÀNH) được xử lý HOÀN TOÀN TRƯỚC bước này, không tính
  vào số lần thử của repair loop.
- **Prompt Eval Flow** (dev-time, không chạy trong production): `lib/prompt-eval/` dùng Promptfoo
  để đo chất lượng template bằng cả MockProvider (CI, $0 chi phí) và AI thật (tốn quota, đo chất
  lượng thực tế) trên cùng dataset, tái sử dụng đúng `validateLatex()`/`generateWithTruncationRecovery()`
  của production để tránh eval đo sai hành vi so với app thật.

## 3. Documentation
- `docs/README.md`: mục lục toàn bộ tài liệu thiết kế.
- `docs/feature-tracking.md`: bảng theo dõi tiến độ chi tiết từng tính năng (E1–E7).
- `docs/project-roadmap.md`, `docs/backend-roadmap.md`, `docs/frontend-roadmap.md`: lộ trình
  theo phase và theo layer.
- `docs/project-overview-pdr.md`: mô tả sản phẩm và mục tiêu kiến trúc.
- `docs/features/`: nghiên cứu từng tính năng (mỗi feature 1 folder, có `explainer.md` +
  `changelog.md` nếu có đo lường lặp lại — ví dụ `e6-prompt-engineering/`).
