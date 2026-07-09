# Implementation Plan — E5 · Markdown → LaTeX Conversion

> Ngày: 2026-07-07 · Theme: **Authoring speed** · Ưu tiên roadmap: **2 (quick win)** · Effort: S–M
> Loại: **plan implement** (checklist đầu việc, thứ tự, file cụ thể). Nền tảng: [`research.md`](./research.md).
> Grounded trên codebase hiện tại (đã audit các file trích trong §2).

---

## Mục lục

1. [Summary](#1-summary)
2. [Technical context](#2-technical-context)
3. [Safety / Constitution gate](#3-safety--constitution-gate)
4. [Kiến trúc & luồng dữ liệu](#4-kiến-trúc--luồng-dữ-liệu)
5. [Thay đổi data model](#5-thay-đổi-data-model)
6. [Cấu trúc module mới](#6-cấu-trúc-module-mới)
7. [Task breakdown theo phase](#7-task-breakdown-theo-phase)
8. [Chiến lược test](#8-chiến-lược-test)
9. [Rollout & cấu hình](#9-rollout--cấu-hình)
10. [Risks & mitigations (thực thi)](#10-risks--mitigations-thực-thi)
11. [Definition of Done](#11-definition-of-done)
12. [Unresolved questions cần chốt trước khi code](#12-unresolved-questions-cần-chốt-trước-khi-code)

---

## 1. Summary

Thêm **đường đầu vào mới**: người dùng soạn/dán **Markdown** → hệ thống chạy **converter tất định**
(MD → *thân* LaTeX) → **bọc preamble** lấy từ template đang chọn (`TEMPLATES`) → `validateLatex` →
compile. Khi converter tạo ra LaTeX không hợp lệ, **tái dùng `runRepairLoop`** (AI chỉ *sửa cho
compile được*, KHÔNG thêm nội dung) làm lưới an toàn.

Chốt quyết định từ research: **Converter tất định là lõi (giải pháp B)**, AI là fallback. Điều này
giữ đúng kỳ vọng "giữ nguyên cấu trúc" của người viết Markdown, chạy offline, $0 token, test bằng
snapshot.

**Nguyên tắc điểm chèn tối thiểu:** không đụng luồng generate-from-description hiện có. E5 là *nhánh
song song* rẽ ở orchestrator dựa trên `inputFormat`.

---

## 2. Technical context

**Ngôn ngữ:** TypeScript 5.x, Next.js 16 (App Router), React 19, Vitest.

**Thư viện parser (cần chốt qua spike — xem §12):** đề xuất **`markdown-it`** + `markdown-it` GFM
tables (nhẹ, token-stream, dễ override rule). Phương án thay thế: `unified`/`remark-parse` (AST sạch
hơn cho cấu trúc lồng). Cả hai pure-JS, không binary hệ thống (loại Pandoc theo research §4).

**File hiện có liên quan (đã audit):**

| File | Vai trò với E5 |
| :-- | :-- |
| `lib/extract/extract.ts` | `classify()` đã coi `md`/`markdown` là `text` → đọc Markdown *đã sẵn*, không cần sửa để ingest. |
| `lib/templates/registry.ts` | `TEMPLATES[id]` có `documentClass` + `packages`. Helper `docRaw()`/`wrap()` build **full doc** nhưng **chưa export** hàm bọc *body tuỳ ý* → **phải thêm** (§6). |
| `lib/validation/validate.ts` | `validateLatex()` (AST + khớp `\begin/\end`) — output converter đi qua đây trước compile. Dùng nguyên. |
| `lib/orchestrator/document.ts` | `runRepairLoop(initialLatex, regenerate, …)` — hiện `runDocument` luôn sinh initial bằng provider. **Cần entry mới** nhận LaTeX dựng sẵn làm `initialLatex`. |
| `lib/types/document.ts` | `DocumentRequest{description,docType,template,sources}` — **thêm** `inputFormat`. |
| `lib/validation/input.ts` | `validateDocumentInput()` — mở rộng để nhận + kiểm `inputFormat` và (khi markdown) trường `markdown`. |
| `app/api/documents/route.ts` | Route tạo tài liệu (JSON + SSE) → rẽ nhánh markdown. |
| `app/components/GeneratorForm.tsx` | Thêm chế độ soạn Markdown + preview. |

**Ràng buộc an toàn compile (BẮT BUỘC kế thừa — ghi trong `registry.ts`):**
- KHÔNG `\includegraphics` file ngoài → ảnh `![]()` → placeholder `\fbox{...}` + comment.
- KHÔNG shell-escape → **KHÔNG `minted`** → dùng `listings`.
- XeLaTeX + `fontspec`, KHÔNG `inputenc/fontenc`, tránh `\setmainfont`.
- Chỉ package phổ biến CTAN.

---

## 3. Safety / Constitution gate

| # | Nguyên tắc (theo `specs/001/plan.md`) | E5 tuân thủ thế nào | Trạng thái |
|---|---|---|---|
| I | Document Reliability First | Converter → validate → compile → repair fallback; luôn trả artifact compile-được hoặc lỗi rõ ràng | ✅ |
| II | Template-First | Bọc body bằng preamble từ `TEMPLATES` — **một nguồn sự thật**, không tạo preamble thứ hai | ✅ |
| III | Verification Pipeline | `validateLatex` chạy trước compile; compiler là chân lý cuối; repair loop có `MAX_REPAIR_ATTEMPTS` | ✅ |
| IV | Security-First | Converter allow-list package; ảnh→placeholder; code→`listings` (không shell-escape); không nhồi raw HTML | ✅ |
| V | Provider-Agnostic | Converter tất định KHÔNG cần provider; fallback dùng `LatexProvider` sẵn có; `MockProvider` vẫn chạy | ✅ |
| VI | Test-First & Incremental | Snapshot test cho từng luật mapping trước khi mở rộng; mỗi phase demo được | ✅ |

**Bảo mật đầu vào Markdown:** coi Markdown là *nội dung người dùng*. Escape đúng vùng text; **không**
truyền raw HTML nhúng vào LaTeX (escape/bỏ). Không có network call mới, không shell-out.

---

## 4. Kiến trúc & luồng dữ liệu

```
┌─ UI: GeneratorForm (chế độ "Markdown") ─ textarea MD + live preview (MD→HTML client)
│                                          │  bấm "Tạo" → gửi { inputFormat:"markdown", markdown, template }
▼
app/api/documents/route.ts  (rẽ nhánh theo inputFormat)
│   inputFormat === "markdown"  →  runDocumentFromMarkdown(...)   [orchestrator entry MỚI]
│   ngược lại (mặc định)        →  runDocument(...)               [đường hiện có, KHÔNG đổi]
▼
lib/orchestrator/document.ts :: runDocumentFromMarkdown()
│   [1] convertMarkdownToLatexBody(markdown, { documentClass })   → body LaTeX + packagesCần[]
│   [2] wrapBodyInTemplate(templateId, body, extraPackages)       → full LaTeX  (registry MỚI)
│   [3] runRepairLoop(fullLatex, regenerateViaProvider, …)        → validate→compile→(AI vá)
▼
DocumentResult (như runDocument) → createDocument(...) (lưu; cân nhắc lưu sourceMarkdown — §5)
```

**Vì sao rẽ ở orchestrator, không ở provider:** converter là bước tất định *trước* AI. `runDocument`
hiện luôn gọi `provider.generate()` để có `initialLatex`; với markdown ta đã có LaTeX dựng sẵn nên
cần entry mới đưa thẳng vào `runRepairLoop` (đã hỗ trợ `initialLatex` — chỉ chưa có caller cho nó).

**Fallback repair — chốt hành vi:** hàm `regenerate` cho nhánh markdown dùng `errorContext`
(previousLatex + errorLog) như hiện có; SYSTEM_PROMPT đã cấm thêm nội dung khi ở lượt sửa lỗi
("giữ nguyên ý đồ nội dung"). Đủ để lưới an toàn *chỉ sửa để compile*, không "sáng tác".

---

## 5. Thay đổi data model

`lib/types/document.ts` — **thêm, không phá field cũ** (giữ tương thích CRUD):

```ts
export type InputFormat = "natural" | "markdown" | "latex"; // mặc định "natural"

export interface DocumentRequest {
  description: string;
  docType: DocType;
  template?: TemplateId;
  sources?: SourceFile[];
  inputFormat?: InputFormat;   // MỚI — thiếu = "natural" (đường cũ)
  markdown?: string;           // MỚI — chỉ dùng khi inputFormat === "markdown"
}
```

`StoredDocument` — **tuỳ chọn** lưu Markdown gốc để round-trip (chốt ở §12 câu 4):

```ts
export interface StoredDocument {
  // ...giữ nguyên...
  inputFormat?: InputFormat;   // MỚI (migration nhẹ: thiếu ⇒ "natural")
  sourceMarkdown?: string;     // MỚI — nếu tạo từ Markdown
}
```

Migration nhẹ trong `documentStore.readDoc()` (theo mẫu `if (!parsed.template) …` sẵn có): tài liệu cũ
thiếu `inputFormat` ⇒ gán `"natural"`.

`lib/validation/input.ts` — `ValidatedInput` thêm `inputFormat`, `markdown?`. Luật kiểm:
- `inputFormat` ∈ {natural, markdown, latex}; thiếu ⇒ "natural".
- Khi `markdown`: `markdown` là chuỗi non-empty, độ dài ≤ `maxInputChars` (tái dùng ngân sách);
  cho phép `description` trống.
- Giữ nguyên đường "natural".

---

## 6. Cấu trúc module mới

Theo AGENTS.md: kebab-case, mô tả dài, mỗi file < 200 dòng.

```
lib/markdown/
├── markdown-to-latex.ts            # orchestrate: parse → emit; export convertMarkdownToLatexBody()
├── markdown-parser.ts              # bọc markdown-it (hoặc remark); cấu hình GFM tables
├── latex-emitter.ts                # duyệt token/AST → phát LaTeX body theo bảng mapping (research §6)
├── latex-escape.ts                 # escape vùng TEXT (& % $ # _ { } ~ ^ \); KHÔNG escape math/code
└── emit-rules/                     # nếu latex-emitter.ts > 200 dòng, tách theo nhóm node
    ├── headings.ts                 #   # → \section/\subsection; class report/thesis → \chapter
    ├── lists.ts                    #   itemize/enumerate (lồng theo độ thụt)
    ├── tables.ts                   #   GFM → tabular + booktabs
    ├── code-and-inline.ts          #   ``` → lstlisting; `code` → \texttt; bold/italic/link
    └── math-and-images.ts          #   $..$/$$..$$ passthrough (→ \[..\]); ![]() → \fbox placeholder
```

`convertMarkdownToLatexBody(markdown, { documentClass })` trả:
```ts
{ body: string; requiredPackages: string[]; warnings: string[] }
```
- `requiredPackages`: suy ra từ nội dung (có code fence ⇒ `listings`; có bảng ⇒ `booktabs`; có link
  ⇒ `hyperref`; có `$`/`$$` ⇒ `amsmath`). Merge với `TEMPLATES[id].packages` khi bọc.
- `warnings`: cú pháp bỏ qua/placeholder (ảnh ngoài, HTML nhúng) → hiển thị cho người dùng.

`lib/templates/registry.ts` — **thêm export mới** (không sửa `docRaw`/`wrap`/`renderMock` hiện có):

```ts
/** Bọc BODY LaTeX tuỳ ý trong preamble của template (nguồn preamble DUY NHẤT). */
export function wrapBodyInTemplate(
  id: TemplateId,
  body: string,
  extraPackages: string[] = [],
): string
```
Dùng lại `docRaw()` (đã có, private) với `documentClass` + `[...packages, ...extraPackages]` (dedupe).
Lưu ý: `docRaw` chèn `\usepackage{fontspec}` + không tự thêm title → phù hợp body do converter phát.

`lib/orchestrator/document.ts` — **thêm** `runDocumentFromMarkdown(req, deps, onChunk?, onCompileStart?)`
tương tự `runDocument` nhưng `initialLatex` = kết quả bước [1][2]; `regenerate` dùng `errorContext`.

**Phạm vi template ở E5.1:** chỉ class `article`/`report` (general, academic, math, physics,
technical, thesis, chemistry, cv). Class đặc biệt `slides` (beamer), `letter`, `exam` có cấu trúc
không ánh xạ tự nhiên từ Markdown → **chặn** (UI ẩn chế độ MD hoặc báo "chưa hỗ trợ") — ghi vào §12.

---

## 7. Task breakdown theo phase

### Phase E5.0 — Spike chọn parser (0.5 ngày)
- [ ] Thử `markdown-it` vs `unified/remark` trên bộ mẫu khó: bảng, list lồng sâu, math trong bảng, code fence. Chốt thư viện. (research §9 câu 1)
- [ ] Ghi kết quả spike vào `docs/features/e5-markdown-to-latex/spike-parser.md`.

### Phase E5.1 — Converter lõi (tất định)
- [ ] `lib/markdown/latex-escape.ts` + test escaping text vs math/code (bẫy lớn nhất — research §6).
- [ ] `lib/markdown/markdown-parser.ts` bọc thư viện đã chọn (+ GFM tables).
- [ ] `lib/markdown/latex-emitter.ts` (+ `emit-rules/*`) phủ bảng mapping research §6: heading, bold/italic, inline code, code fence→`listings`, list (lồng), GFM table→`tabular`+`booktabs`, link→`\href`, ảnh→`\fbox` placeholder, quote, hr, math passthrough.
- [ ] Luật heading theo `documentClass`: `report` ⇒ `# → \chapter`; `article` ⇒ `# → \section` (chốt §12 câu 2).
- [ ] `convertMarkdownToLatexBody()` gom body + `requiredPackages` + `warnings`.
- [ ] Snapshot test cho từng nhóm cú pháp (§8).

### Phase E5.2 — Bọc template + orchestrator
- [ ] `registry.ts`: thêm `wrapBodyInTemplate()` + unit test (đúng documentClass, merge/dedupe packages, có `fontspec`).
- [ ] `lib/orchestrator/document.ts`: thêm `runDocumentFromMarkdown()`; fallback repair cấm thêm nội dung.
- [ ] Integration test: MD mẫu → `runDocumentFromMarkdown` (MockProvider + compile mock) → PASS không cần fallback.

### Phase E5.3 — Data model + API
- [ ] `lib/types/document.ts`: thêm `InputFormat`, `DocumentRequest.inputFormat/markdown`, `StoredDocument.inputFormat/sourceMarkdown?`.
- [ ] `lib/validation/input.ts`: kiểm `inputFormat` + `markdown`; giữ đường "natural".
- [ ] `documentStore.readDoc()`: migration nhẹ `inputFormat` thiếu ⇒ "natural".
- [ ] `app/api/documents/route.ts`: rẽ nhánh `inputFormat === "markdown"` → `runDocumentFromMarkdown` (cả path JSON và SSE); lưu `sourceMarkdown` nếu chốt.
- [ ] Route test: body markdown hợp lệ → 201; markdown rỗng → 400.

### Phase E5.4 — UI
- [ ] `GeneratorForm.tsx`: toggle "Mô tả" ↔ "Markdown"; ở chế độ MD hiện textarea + **live preview MD→HTML** (client, vd `markdown-it` cùng lib — preview KHÁC output LaTeX, ghi chú rõ).
- [ ] Gửi `{ inputFormat, markdown, template }`; ẩn chế độ MD cho template beamer/letter/exam (E5.1 scope).
- [ ] Hiển thị `warnings` (ảnh→placeholder, HTML bỏ) sau khi tạo.
- [ ] Component test (RTL): chuyển chế độ, submit markdown gọi đúng payload.

### Phase E5.5 — Hoàn thiện
- [ ] Cập nhật `docs/feature-tracking.md` (đánh dấu các đầu việc E5), `README.md` (bỏ E5 khỏi "chưa có" khi xong), `.env.example` nếu thêm biến.
- [ ] `npm run lint && npm test && npm run build` xanh.

---

## 8. Chiến lược test

- **Snapshot (lõi):** `lib/markdown/__tests__/*.test.ts` — mỗi cú pháp một cặp MD→LaTeX kỳ vọng.
  Bao phủ bắt buộc: escaping text vs math/code; bảng; code fence→listings; list lồng; heading theo class.
- **Bất biến cấu trúc:** số heading MD = số `\section`/`\chapter` phát ra (research §8).
- **Integration:** `runDocumentFromMarkdown` với `MockProvider` + compile mock → PASS *không* chạm fallback trên bộ mẫu phổ biến (đo tỉ lệ convert-không-cần-AI).
- **Route/Component:** như Phase E5.3/E5.4.
- Test theo Vitest (khớp hạ tầng hiện có); dọn file tạm nếu có.

---

## 9. Rollout & cấu hình

- **Biến môi trường mới** (`lib/config.ts` + `.env.example`), có mặc định an toàn:
  - `MARKDOWN_INPUT_ENABLED` (mặc định `true`) — cờ bật/tắt tính năng để rollout an toàn.
  - (Tái dùng `MAX_INPUT_CHARS` cho độ dài Markdown — không cần biến mới.)
- **Không** thay đổi compile-service, Docker, hay biến bảo mật.
- Rollout tăng dần: bật ở dev → staging; theo dõi tỉ lệ rơi vào repair loop (research §8) để mở rộng luật mapping.

---

## 10. Risks & mitigations (thực thi)

| Rủi ro | Giảm thiểu (đầu việc cụ thể) |
| :-- | :-- |
| Escaping text vs math/code sai → lỗi compile hàng loạt | `latex-escape.ts` tách vùng rõ ràng; snapshot test dày; repair loop vá phần sót |
| Trùng nguồn preamble với luồng generate → drift | **Bắt buộc** dùng `wrapBodyInTemplate()` (dựa `TEMPLATES`); cấm hard-code preamble trong emitter |
| Ảnh ngoài không dựng được | Placeholder `\fbox` + `warnings` rõ ràng; định tuyến sang E1 (asset) sau |
| Gói phát sinh không hợp sandbox (minted/graphicx ngoài) | Allow-list: code→`listings`; ảnh→placeholder; `requiredPackages` chỉ chứa gói an toàn |
| AI fallback "chế thêm" nội dung | Chỉ dùng `errorContext` (lượt sửa lỗi, SYSTEM_PROMPT cấm đổi ý đồ); không dùng path description |
| Cú pháp MD lạ (footnote, def list, HTML nhúng) | Phủ GFM core trước; phần lạ → `warnings` + fallback repair; HTML nhúng bị escape/bỏ |

---

## 11. Definition of Done

- Bộ mẫu Markdown phổ biến (heading/list/table/code/math/link) **compile PASS tất định** không cần AI.
- Cấu trúc bảo toàn (test số heading = số section/chapter).
- Đường "natural" cũ **không đổi hành vi** (regression test xanh).
- CRUD tài liệu tương thích (tài liệu cũ đọc được nhờ migration `inputFormat`).
- `lint` + `test` + `build` xanh; docs cập nhật.

---

## 12. Unresolved questions cần chốt trước khi code

1. **Parser: `markdown-it` hay `unified/remark`?** — chốt sau spike E5.0.
2. **Heading → `\chapter` khi nào?** — theo `documentClass` (đề xuất: report/thesis ⇒ `\chapter`) hay cho người dùng chọn? Đề xuất: theo class, tự động.
3. **Ảnh:** placeholder (E5) hay chờ pipeline asset của **E1**? Đề xuất: placeholder trước, ghi phụ thuộc E1.
4. **Lưu `sourceMarkdown`?** — có để round-trip sửa lại từ MD không? Ảnh hưởng `StoredDocument` + UI chỉnh sửa. Đề xuất: lưu (rẻ, mở đường round-trip).
5. **Template beamer/letter/exam + Markdown:** chặn ở E5.1 hay ánh xạ tối thiểu? Đề xuất: chặn, làm sau.
6. **Preview:** MD→HTML client (nhanh, khác kết quả LaTeX) — xác nhận chấp nhận sai khác preview↔PDF.
