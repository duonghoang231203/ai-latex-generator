# Tasks: LaTeX Document Generation (MVP)

**Input**: Design documents from `/specs/001-latex-document-generation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED — bắt buộc theo Nguyên tắc VI (Test-First) của hiến pháp và Definition of Done ở
`docs/08-roadmap.md`. Trong mỗi user story, viết test TRƯỚC và đảm bảo FAIL trước khi hiện thực.

**Organization**: Nhóm theo user story để hiện thực & test độc lập từng story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1/US2/US3 (map user story trong spec.md)
- Đường dẫn theo `plan.md` §Project Structure (Next.js app ở repo root: `app/`, `lib/`, `tests/`;
  microservice ở `compile-service/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Khởi tạo cấu trúc & công cụ.

- [X] T001 Tạo cấu trúc thư mục theo plan: `lib/{ai,validation,orchestrator,compile,ratelimit,types}/`, `app/components/`, `app/api/{document,generate,compile}/`, `tests/{unit,integration,eval}/`, `compile-service/`
- [X] T002 Cài dependencies: `latex-utensils`, SDK AI (`@anthropic-ai/sdk`, `openai`), `express` (cho compile-service), `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` (pin phiên bản cụ thể)
- [X] T003 [P] Cấu hình Vitest + React Testing Library trong `vitest.config.ts` và `tests/setup.ts`
- [X] T004 [P] Thêm path alias (`@/lib/*`) trong `tsconfig.json` và cập nhật `eslint.config.mjs`
- [X] T005 [P] Tạo `.env.example` với đầy đủ biến (theo docs/11 §11.6)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hạ tầng lõi mọi user story phụ thuộc. ⚠️ Phải xong trước khi bắt đầu US bất kỳ.

- [X] T006 [P] Định nghĩa shared types (`DocType`, `DocumentRequest/Response/Error`, `CompileResult`) trong `lib/types/document.ts` (theo data-model.md)
- [X] T007 [P] Loader cấu hình môi trường (đọc/validate env, default) trong `lib/config.ts`
- [X] T008 [P] Interface `LatexProvider` + `GenerateInput` + `ErrorContext` trong `lib/ai/types.ts`
- [X] T009 [P] `MockProvider` (kịch bản cấu hình được: happy / lỗi-rồi-đúng / luôn lỗi) trong `lib/ai/mock.ts`
- [X] T010 Provider factory `getProvider()` đọc `AI_PROVIDER` trong `lib/ai/factory.ts` (depends T008, T009)
- [X] T011 [P] Unit test factory (chọn đúng provider, ném lỗi khi env sai) + MockProvider trong `tests/unit/ai-factory.test.ts`
- [X] T012 [P] `validateLatex()` dùng `latex-utensils` → `ValidationResult` trong `lib/validation/validate.ts`
- [X] T013 [P] Sanitize output AI (bóc fence, kiểm `\documentclass`/`\begin`/`\end{document}`) trong `lib/ai/sanitize.ts`
- [X] T014 [P] Unit test cho `validateLatex` (môi trường hở, math mode hở) và `sanitize` trong `tests/unit/validation.test.ts`
- [X] T015 Compile core: tạo tmp dir cô lập, chạy `tectonic --untrusted` + timeout + cleanup trong `compile-service/compile.js`
- [X] T016 Express server `POST /compile` (trả PDF binary hoặc `{success:false,log}`) + `GET /health` trong `compile-service/server.js` (depends T015)
- [X] T017 [P] `Dockerfile` compile-service: cài Tectonic, user non-root, read-only fs (theo docs/07) trong `compile-service/Dockerfile`
- [X] T018 Integration test compile-service (LaTeX hợp lệ→`%PDF-`; lỗi→log; timeout; cleanup; /health) trong `compile-service/test/compile.test.js`
- [X] T019 [P] Client gọi compile-service (`COMPILE_SERVICE_URL`, timeout, map lỗi mạng) trong `lib/compile/client.ts`
- [X] T020 Route `/api/compile` (nhận `{latex}` → gọi client → PDF binary hoặc log) trong `app/api/compile/route.ts` (depends T019; Node runtime, dynamic)
- [X] T021 [P] Integration test `/api/compile` với compile-service mock (PDF / log / service chết) trong `tests/integration/api-compile.test.ts`

**Checkpoint**: Hạ tầng sẵn sàng — có thể bắt đầu các user story.

---

## Phase 3: User Story 1 — Sinh tài liệu từ mô tả và nhận PDF (Priority: P1) 🎯 MVP

**Goal**: Người dùng nhập mô tả + chọn article/report → nhận PDF hợp lệ (happy path, `attempts=1`), xem trước + tải về + xem source.

**Independent Test**: `POST /api/document {description, docType}` với provider trả LaTeX hợp lệ → nhận `{latex, pdfBase64, attempts:1, metadata}`; UI render PDF + tab source + nút tải.

### Tests for User Story 1 ⚠️ (viết trước, phải FAIL)

- [X] T022 [P] [US1] Integration test `/api/document` happy path (attempts=1, có pdfBase64+metadata) với MockProvider+compile mock trong `tests/integration/api-document-happy.test.ts`
- [X] T023 [P] [US1] Component test `GeneratorForm` (submit đúng payload) và `ResultPanel` (render PDF, đổi tab source) trong `app/components/__tests__/us1.test.tsx`

### Implementation for User Story 1

- [X] T024 [P] [US1] Prompt system + user (template-first, XeLaTeX+fontspec/polyglossia, cấm shell-escape) trong `lib/ai/prompts.ts`
- [X] T025 [US1] `AnthropicProvider` (temperature 0.2, timeout) trong `lib/ai/anthropic.ts` (depends T008, T024)
- [X] T026 [P] [US1] `OpenAIProvider` (thay thế) trong `lib/ai/openai.ts` (depends T008, T024)
- [X] T027 [US1] Route `/api/generate` (validate cơ bản → `provider.generate` → `{latex}`) trong `app/api/generate/route.ts` (depends T010, T024)
- [X] T028 [US1] Orchestrator single-pass (generate → `validateLatex` → `compile` → gói metadata engine=xetex/template, `toBase64`) trong `lib/orchestrator/document.ts` (depends T012, T013, T019)
- [X] T029 [US1] Route `/api/document` gọi orchestrator, trả `DocumentResponse` (base64 JSON) trong `app/api/document/route.ts` (depends T028; Node runtime, dynamic)
- [X] T030 [P] [US1] `DocTypeSelect` (article/report) trong `app/components/DocTypeSelect.tsx`
- [X] T031 [P] [US1] `GeneratorForm` (textarea + select + submit) trong `app/components/GeneratorForm.tsx`
- [X] T032 [P] [US1] `PdfPreview` (blob/base64 → iframe, revokeObjectURL) trong `app/components/PdfPreview.tsx`
- [X] T033 [P] [US1] `LatexSource` (hiển thị source read-only) trong `app/components/LatexSource.tsx`
- [X] T034 [P] [US1] `StatusBanner` (idle/loading/success/error) trong `app/components/StatusBanner.tsx`
- [X] T035 [US1] `ResultPanel` (tab PDF|source, nút tải PDF) trong `app/components/ResultPanel.tsx` (depends T032, T033)
- [X] T036 [US1] Ghép `app/page.tsx`: state, gọi `/api/document`, tạo/thu hồi object URL, hiển thị attempts (depends T031, T034, T035)

**Checkpoint**: US1 chạy độc lập — nhập mô tả → PDF hợp lệ.

---

## Phase 4: User Story 2 — Tự sửa khi tài liệu không dựng được (Priority: P2)

**Goal**: Khi validate/compile lỗi, orchestrator tự sửa lặp (≤ `MAX_REPAIR_ATTEMPTS`); trả PDF (`attempts>1`) hoặc lỗi có kiểm soát kèm latex/log gần nhất.

**Independent Test**: MockProvider "lỗi lần 1 → đúng lần 2" → `attempts=2`, có PDF; "luôn lỗi" → `DocumentError {attempts=N}` (HTTP 200).

### Tests for User Story 2 ⚠️ (viết trước, phải FAIL)

- [X] T037 [P] [US2] Integration tests repair: AST-repair, compile-repair (attempts=2), fail (attempts=N) trong `tests/integration/api-document-repair.test.ts`

### Implementation for User Story 2

- [X] T038 [US2] Repair prompt dùng `errorContext` (previousLatex + diagnostics|errorLog) trong `lib/ai/prompts.ts` (mở rộng)
- [X] T039 [US2] Rút gọn log Tectonic quanh dòng lỗi (`! LaTeX Error`, `l.<n>`) trong `lib/orchestrator/truncateLog.ts`
- [X] T040 [US2] Mở rộng orchestrator: vòng lặp validate/compile → patch với `errorContext`, đếm `attempts`, dừng ở `MAX_REPAIR_ATTEMPTS`, trả `DocumentError` khi hết lượt trong `lib/orchestrator/document.ts` (depends T038, T039)
- [X] T041 [US2] UI: hiển thị `attempts`; khi thất bại hiện thông báo + cho xem latex/log gần nhất trong `app/components/ResultPanel.tsx` + `StatusBanner.tsx`

**Checkpoint**: US1 + US2 đều chạy độc lập.

---

## Phase 5: User Story 3 — Xử lý lỗi đầu vào & phản hồi trạng thái (Priority: P3)

**Goal**: Chặn input không hợp lệ, giới hạn tần suất, và hiển thị trạng thái/lỗi thân thiện.

**Independent Test**: submit rỗng → bị chặn ở UI; mô tả > `MAX_INPUT_CHARS` → 400; > 10 req/phút/IP → 429; lỗi dịch vụ → thông báo thân thiện + retry.

### Tests for User Story 3 ⚠️ (viết trước, phải FAIL)

- [X] T042 [P] [US3] Integration tests: validate input (rỗng/quá dài → 400), rate limit (429), mapping lỗi 502/500 trong `tests/integration/api-document-validation.test.ts`
- [X] T043 [P] [US3] Component test: chặn submit khi rỗng, chỉ báo loading, nút thử lại trong `app/components/__tests__/us3.test.tsx`

### Implementation for User Story 3

- [X] T044 [US3] Util validate input (non-empty sau trim, ≤ `MAX_INPUT_CHARS`, `docType` hợp lệ) trong `lib/validation/input.ts`
- [X] T045 [US3] Token-bucket rate limit in-memory theo IP (mặc định 10/phút, cấu hình được) trong `lib/ratelimit/tokenBucket.ts`
- [X] T046 [US3] Ghép validate + rate limit + mapping HTTP status (400/429/502/500; repair-fail giữ 200) vào `app/api/document/route.ts` (depends T044, T045)
- [X] T047 [US3] UI: disable submit khi rỗng/đang xử lý, thông báo lỗi thân thiện (ẩn stack trace), nút "Thử lại" + "Xem chi tiết" trong `app/components/GeneratorForm.tsx` + `StatusBanner.tsx`

**Checkpoint**: Cả 3 user story chạy độc lập.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T048 [P] `docker-compose.yml`: `next-app` (3000) + `compile-service` (nội bộ, không expose, read_only, tmpfs, volume cache) theo docs/07 §7.9
- [X] T049 [P] Hoàn thiện `.env.example` + cập nhật `README.md` cách chạy `docker compose up`
- [X] T050 Security suite: `\write18`/shell-escape bị từ chối, xác nhận `--untrusted`, non-root trong `compile-service/test/security.test.js` (doc 09 §9.1 mục 5)
- [X] T051 [P] Test-case runner đọc `docs/testcases/testcases.json` lọc `scope=mvp` (TC-01/02/05) trong `tests/eval/testcases.test.ts`
- [ ] T052 Chạy kiểm chứng `quickstart.md` end-to-end (V1–V5) qua `docker compose up` — ✅ V1 (happy path) ĐÃ VERIFY THẬT: `docker compose up` trên máy arm64, `/api/document` (mock) → Tectonic compile → PDF (attempts:1, engine xetex). Còn lại: V4 security \write18 và chạy với AI provider thật (OpenAI/Anthropic) khi có key.
- [X] T053 [P] Lint/build sạch toàn repo + đồng bộ ghi chú `docs/` nếu có sai khác thực tế

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (P1)**: không phụ thuộc — bắt đầu ngay.
- **Foundational (P2)**: sau Setup — **chặn mọi user story**. Trong đây, nhánh AI (T008–T014) và nhánh compile (T015–T021) **song song được**.
- **User Stories (P3–P5)**: đều sau Foundational. US1 nên xong trước (MVP); US2/US3 mở rộng, độc lập-test được.
- **Polish (P6)**: sau khi các story mong muốn đã xong.

### User Story Dependencies
- **US1 (P1)**: chỉ cần Foundational. Là MVP tối thiểu.
- **US2 (P2)**: mở rộng orchestrator (T028) của US1; test độc lập bằng MockProvider.
- **US3 (P3)**: bọc thêm validate/rate-limit/error quanh `/api/document`; không phá US1/US2.

### Within Each Story
- Test viết trước và FAIL → rồi hiện thực. Types → provider/validation → orchestrator → route → UI.

### Parallel Opportunities
- Setup: T003, T004, T005 song song.
- Foundational: nhánh AI (T008,T009,T012,T013 + tests T011,T014) ∥ nhánh compile (T015→T016, T017, T019→...). Nhiều task [P] khác file.
- US1: components T030–T034 song song; providers T024/T026 [P]; tests T022/T023 [P].
- Sau Foundational, nếu đủ người: US1/US2/US3 chạy song song theo 3 dev.

---

## Parallel Example: User Story 1

```bash
# Tests trước (song song):
Task: "Integration test /api/document happy path — tests/integration/api-document-happy.test.ts"
Task: "Component test GeneratorForm/ResultPanel — app/components/__tests__/us1.test.tsx"

# Components (song song):
Task: "DocTypeSelect — app/components/DocTypeSelect.tsx"
Task: "GeneratorForm — app/components/GeneratorForm.tsx"
Task: "PdfPreview — app/components/PdfPreview.tsx"
Task: "LatexSource — app/components/LatexSource.tsx"
Task: "StatusBanner — app/components/StatusBanner.tsx"
```

---

## Implementation Strategy

### MVP First (US1 only)
1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 US1 → 4. **STOP & VALIDATE** (test US1 độc lập, demo) → deploy nếu sẵn sàng.

### Incremental Delivery
Setup+Foundational → US1 (MVP demo) → US2 (repair) → US3 (robustness) → Polish. Mỗi story thêm giá trị không phá story trước.

### Parallel Team Strategy
Cả nhóm làm Setup+Foundational; sau đó Dev A: US1, Dev B: US2, Dev C: US3; tích hợp độc lập.

---

## Notes
- [P] = khác file, không phụ thuộc. [Story] để truy vết.
- Verify test FAIL trước khi hiện thực (Nguyên tắc VI).
- Commit sau mỗi task/nhóm hợp lý. Dừng ở checkpoint để validate story độc lập.
- Gate bảo mật (Nguyên tắc IV): T015–T018, T050 không được bỏ qua để "đi nhanh".
