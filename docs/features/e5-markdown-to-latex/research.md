# Research — E5 · Markdown → LaTeX Conversion

> Ngày: 2026-07-05 · Theme: **Authoring speed** · Ưu tiên roadmap: **2 (quick win)** · Effort: S–M
> Loại: **tài liệu tìm hiểu / research giải pháp** (không phải plan implement).
> Grounded trên codebase tại thời điểm viết (xem *Current-state audit*).

---

## Mục lục

1. [Problem statement](#1-problem-statement)
2. [Current-state audit](#2-current-state-audit)
3. [Câu hỏi kiến trúc cốt lõi](#3-câu-hỏi-kiến-trúc-cốt-lõi)
4. [Solution landscape](#4-solution-landscape)
5. [Recommended approach](#5-recommended-approach)
6. [Bảng ánh xạ Markdown → LaTeX](#6-bảng-ánh-xạ-markdown--latex)
7. [Risks & mitigations](#7-risks--mitigations)
8. [Success signals](#8-success-signals)
9. [Unresolved questions](#9-unresolved-questions)

---

## 1. Problem statement

**Đau (P5 trong roadmap):** người dùng muốn *viết nháp nhanh* bằng cú pháp quen thuộc (Markdown)
thay vì gõ mô tả tự nhiên rồi chờ AI đoán cấu trúc. Markdown đã là "lingua franca" của dân viết
lách/kỹ thuật: heading, list, bảng, code, `$math$` — ai cũng biết. LaTeX thì rào cản cao.

**Kết quả muốn có:** người dùng dán/soạn Markdown → nhận **thân LaTeX chuẩn**, ghép vào template
đang chọn, compile ra PDF. Metric: ↑ % tài liệu khởi tạo từ Markdown; ↓ thời gian tới bản nháp đầu.

**Ranh giới quan trọng:** đây là *authoring input mới*, KHÔNG phải "diễn giải ý tưởng". Người dùng
Markdown kỳ vọng **giữ nguyên cấu trúc họ viết** (tiêu đề nào ra section đó, bảng ra bảng). Đây là
điểm phân biệt cốt lõi với luồng generate-from-description hiện có (vốn *chủ động mở rộng* nội dung).

---

## 2. Current-state audit

Hiện trạng liên quan (trích file cụ thể):

| Thành phần | File | Vai trò với E5 |
| :-- | :-- | :-- |
| Sinh LaTeX từ NL | `lib/ai/prompts.ts` → `buildUserPrompt` | Prompt hiện *chủ động mở rộng* nội dung — ngược kỳ vọng "giữ nguyên" của Markdown. |
| Nguồn upload | `lib/extract/extract.ts` `classify()` | `md`/`markdown` **đã** được nhận là `text` và đọc thành chuỗi → hạ tầng đọc Markdown *đã có sẵn*. |
| Kiểu dữ liệu | `lib/types/document.ts` | `SourceFile{name,content}`, `TemplateId` (11 dạng), `DocType` article\|report. Chưa có kiểu "input format". |
| Template | `lib/templates/registry.ts` `TEMPLATES` | Mỗi template có `documentClass` + `packages` + `promptGuidance` + `renderMock`. **Đây là nơi lấy preamble** để bọc thân đã convert. |
| Validate | `lib/validation/validate.ts` `validateLatex` | AST (latex-utensils) + khớp `\begin/\end`. Chạy *trước* compile. Converter output nên đi qua đây. |
| Repair loop | `lib/orchestrator/document.ts` `runRepairLoop` | validate → compile → patch (AI sửa). Có thể tái dùng cho "long tail" convert lỗi. |
| Compile | `lib/compile/client.ts` + `compile-service` | Tectonic `--untrusted`, XeLaTeX. |

**Ràng buộc an toàn compile (bắt buộc kế thừa — ghi rõ trong `registry.ts`):**

- **Không `\includegraphics` file ngoài** — sandbox không có file người dùng → ảnh Markdown `![](url)`
  **không thể** map thẳng thành `\includegraphics`.
- **Không shell-escape** → **không dùng `minted`** cho code block (minted cần `-shell-escape`).
  → phải dùng `listings` / `verbatim`.
- **XeLaTeX + fontspec**, không `inputenc/fontenc`; tránh `\setmainfont`. Unicode/tiếng Việt OK sẵn.
- Chỉ gói phổ biến CTAN.

**Phát hiện then chốt:** hạ tầng *đọc* Markdown đã có (extract coi `.md` là text). Cái **thiếu** là
(a) bước *chuyển cú pháp* MD→LaTeX giữ cấu trúc, và (b) chỗ *khai báo input là Markdown* trong data
model + UI. Đây là feature *bổ sung một bước biến đổi*, không phải đại phẫu.

---

## 3. Câu hỏi kiến trúc cốt lõi

> **Dự án đã có LLM sinh LaTeX hoàn chỉnh + repair loop. Vậy có cần một converter tất định
> (deterministic) MD→LaTeX riêng không, hay chỉ cần nhồi Markdown vào prompt sẵn có?**

Đây là quyết định định hình toàn bộ effort. Hai triết lý:

- **A — "Cứ để AI làm":** thêm 1 nhánh prompt "đây là Markdown, hãy chuyển sang LaTeX giữ nguyên cấu
  trúc". Gần như 0 code mới. Nhưng: **không tất định** (cùng input, output khác nhau), tốn token +
  latency mỗi lần, và mâu thuẫn bản chất — người viết Markdown muốn *chính xác cấu trúc*, không muốn
  AI "sáng tác thêm". Khó test.
- **B — Converter tất định:** parse Markdown → phát LaTeX theo luật cố định, ghép preamble template.
  **Tất định, offline, gần như tức thì, $0 token, test được**. Đây đúng tinh thần *quick win* (effort
  S–M, độc lập epic khác — như roadmap ghi). Chi phí: phải tự lo phần đuôi dài (edge cases).

**Nhận định:** bản chất MD→LaTeX là *dịch cú pháp có cấu trúc*, không phải *suy luận nội dung* — đây là
địa hạt của trình biên dịch tất định, không phải LLM. Chọn **B làm lõi**, dùng **A làm lưới an toàn**
cho phần convert-lỗi (tái dùng `runRepairLoop`). Xem [§5](#5-recommended-approach).

---

## 4. Solution landscape

Các cách hiện thực bước chuyển cú pháp (khảo sát 2025):

| Giải pháp | Bản chất | Ưu | Nhược | Hợp với dự án? |
| :-- | :-- | :-- | :-- | :-- |
| **Pandoc** (qua `node-pandoc`) | Shell-out tới binary Pandoc | Chất lượng tham chiếu vàng; phủ mọi cú pháp | **Binary hệ thống** (phải nhét vào image Next); shell-out ngược tinh thần no-shell; khó kiểm soát preamble; output template riêng của Pandoc | ❌ Nặng cho một quick win; thêm phụ thuộc hệ thống |
| **`unified` + `remark-parse` → mdast → LaTeX** | AST pipeline thuần JS | Cùng hệ sinh thái Next/JS; AST sạch để map chính xác sang template; kiểm soát từng node | Cần lớp mdast→LaTeX tự viết (không có bộ chính chủ mạnh); `remark-latex` cũ (2018) | ✅ **Tốt** — kiểm soát cao, pure JS |
| **`markdown-it` + custom renderer rules** | Token stream + renderer | Nhẹ, nhanh, phổ biến, dễ override rule; nhiều plugin (GFM tables, math) | Token stream "phẳng" hơn AST → xử lý lồng nhau thủ công hơn | ✅ **Tốt** — pragmatic, nhẹ |
| **`@md-to-latex/converter`** | Lib chuyên MD→LaTeX | Đúng bài toán ngay | Ít phổ biến/bảo trì; áp đặt quy ước riêng; rủi ro sinh gói không hợp sandbox (vd `minted`, `graphicx` ảnh ngoài) | ⚠️ Dùng tham khảo mapping, không nên phụ thuộc lõi |
| **`mathpix-markdown-it`** | markdown-it cho cộng đồng khoa học | Mạnh về math/table | Thiên về *render HTML/SVG*, không phải sinh LaTeX body sạch để compile | ⚠️ Chỉ tham khảo phần math |
| **AI-based (nhồi prompt)** | Dùng `LatexProvider` sẵn | ~0 code; xử lý mọi rìa | Không tất định, tốn token/latency, khó test, dễ "chế thêm" | ⚠️ Chỉ làm *fallback* |

**Về xử lý toán học — điểm sáng:** Markdown inline `$...$` / display `$$...$$` **chính là** cú pháp
toán LaTeX. Chiến lược đúng là **passthrough** (chuyển thẳng, chỉ đổi `$$...$$` → `\[...\]`), đảm bảo
template có `amsmath`/`amssymb`. Không cần dịch — đây là phần "free win" lớn nhất của MD→LaTeX so với
các format khác.

---

## 5. Recommended approach

**Hybrid: converter tất định (lõi) + template-aware wrapping + repair loop (đuôi dài).**

### 5.1 Kiến trúc đề xuất (khối, không phải plan)

```
Markdown (editor/upload)
   │
   ▼
[1] Parser thuần JS            ─ đề xuất: markdown-it (+ GFM tables) HOẶC unified/remark
   │   (chọn theo §4; ưu tiên thư viện AST/token ổn định, pure-JS)
   ▼
[2] Emitter MD→LaTeX body      ─ luật cố định (bảng §6); math passthrough;
   │                              ảnh → placeholder box (KHÔNG \includegraphics ngoài)
   ▼
[3] Template wrapper           ─ lấy documentClass + packages từ TEMPLATES[templateId]
   │                              (lib/templates/registry.ts) → ghép preamble + body
   ▼
[4] validateLatex()            ─ AST + khớp môi trường (lib/validation/validate.ts)
   │      ├─ ok  → compile (đường hiện có)
   │      └─ lỗi → [5]
   ▼
[5] runRepairLoop fallback     ─ đưa body lỗi + log cho LatexProvider sửa (tái dùng nguyên si)
```

**Vì sao khối này đúng:**
- Bước [1][2] tất định phủ ~80% cú pháp thường gặp → nhanh, offline, $0, test bằng snapshot.
- Bước [3] **tái dùng `registry.ts`** — không tạo nguồn preamble thứ hai (tránh drift với luồng
  generate). Đảm bảo gói cần (`booktabs`, `amsmath`, `hyperref`, `listings`) có mặt.
- Bước [4][5] **tái dùng validation + repair loop** đã kiểm nghiệm → converter không cần "hoàn hảo",
  chỉ cần "đủ tốt để compile hoặc để AI vá nốt". Đây là điểm giúp effort ở mức S–M.

### 5.2 Nơi đặt code (gợi ý, khớp quy ước hiện tại)

- `lib/markdown/` (module mới) — `parse` + `emit` + mapping. Tách nhỏ <200 dòng/file theo AGENTS.md.
- Mở rộng data model: thêm nhãn nguồn input (vd `inputFormat: "markdown" | "latex" | "natural"`)
  vào `DocumentRequest` (`lib/types/document.ts`) — *không* phá vỡ field cũ.
- UI: chế độ soạn Markdown + **live preview** (render MD→HTML ở client để xem trước; convert ra
  LaTeX khi bấm tạo). Preview HTML tách biệt với emit LaTeX — đừng nhầm hai đường.

### 5.3 Xử lý 3 ca "khó" (quyết định thiết kế)

1. **Ảnh `![alt](src)`** — sandbox không có file ngoài → **không** `\includegraphics`. Lựa chọn:
   (a) hộp placeholder `\fbox{...alt...}` + comment `% TODO image`; (b) nối vào pipeline upload asset
   (thuộc E1 multi-file, ngoài phạm vi quick win). → **Đề xuất (a)** cho E5, ghi chú phụ thuộc E1.
2. **Code block** — `minted` cấm (shell-escape) → dùng **`listings`** (`\begin{lstlisting}`) hoặc
   `verbatim`. Thêm `listings` vào packages khi có code fence.
3. **HTML nhúng trong Markdown** — bỏ qua/escape an toàn (không nhồi raw HTML vào LaTeX).

---

## 6. Bảng ánh xạ Markdown → LaTeX

Luật tất định cho bước [2] (đuôi dài để repair loop lo):

| Markdown | LaTeX phát ra | Ghi chú |
| :-- | :-- | :-- |
| `# H1` / `## H2` / `### H3` | `\section` / `\subsection` / `\subsubsection` | Với class `report`/thesis: H1→`\chapter`. Lấy theo `documentClass`. |
| `**bold**` / `*italic*` | `\textbf{}` / `\emph{}` | |
| `` `code` `` | `\texttt{}` | escape ký tự đặc biệt |
| ` ```lang ... ``` ` | `\begin{lstlisting}...\end{lstlisting}` | cần `listings`; **không** minted |
| `- a` / `1. a` | `itemize` / `enumerate` | lồng nhau theo độ thụt |
| GFM table | `tabular` (+ `booktabs`) | cần `booktabs` |
| `[text](url)` | `\href{url}{text}` | cần `hyperref` |
| `![alt](src)` | `\fbox{alt}` + `% TODO image` | **không** file ngoài (sandbox) |
| `> quote` | `quote` env | |
| `---` | `\hrulefill` / bỏ | |
| `$x$` / `$$x$$` | `$x$` / `\[x\]` | **passthrough**; cần `amsmath` |
| ký tự `& % $ # _ { } ~ ^ \` | escape (`\&`…) | **chỉ** ngoài vùng math/code |

**Bẫy escaping quan trọng:** phải phân biệt vùng *text* (cần escape `&%$#_{}`) với vùng *math/code*
(không escape). Sai chỗ này là nguồn lỗi compile lớn nhất → cần test bao phủ.

---

## 7. Risks & mitigations

| Rủi ro | Ảnh hưởng | Giảm thiểu |
| :-- | :-- | :-- |
| Escaping text vs math/code sai | Lỗi compile hàng loạt | Test snapshot theo mẫu; tách rõ vùng khi emit; repair loop vá phần sót |
| Ảnh không dựng được (sandbox) | Người dùng hụt hẫng | Placeholder + thông báo rõ; định tuyến sang E1 (asset) sau |
| Cú pháp MD lạ (footnote, def list, HTML) | Convert thiếu | Phủ GFM core trước; phần lạ → fallback AI (`runRepairLoop`) |
| Gói phát sinh không hợp sandbox (minted/graphicx ngoài) | Compile fail | Danh sách gói **allow-list**; map code→listings; ảnh→placeholder |
| Trùng lặp nguồn preamble với luồng generate | Drift/bảo trì | **Bắt buộc** lấy preamble từ `TEMPLATES` — một nguồn sự thật |
| Người dùng kỳ vọng "giữ nguyên" nhưng AI-fallback chế thêm | Mất lòng tin | Fallback chỉ *sửa để compile*, prompt cấm thêm nội dung mới |

---

## 8. Success signals

- Bộ mẫu Markdown phổ biến (heading/list/table/code/math/link) → **compile PASS tất định** không cần
  AI (đo tỉ lệ convert-không-cần-fallback).
- Cấu trúc bảo toàn: số heading MD = số section/chapter LaTeX (kiểm bằng test).
- Thời gian tới bản nháp đầu (Markdown) < luồng mô tả tự nhiên (vì bỏ được vòng "AGI đoán cấu trúc").
- Tỉ lệ rơi vào repair loop thấp & giảm dần khi mở rộng luật mapping.

---

## 9. Unresolved questions

1. **Chọn `markdown-it` hay `unified/remark`?** — cần một *spike* nhỏ so hai bên trên chính bộ mẫu
   test (đặc biệt: bảng lồng, list lồng sâu, math trong bảng). Token-stream (markdown-it) nhẹ hơn;
   AST (unified) map cấu trúc chuẩn hơn. Chưa chốt.
2. **Heading→`\chapter` khi nào?** — phụ thuộc `documentClass` template. Với `article` không có
   `\chapter`. Cần luật: map theo class hay theo lựa chọn người dùng?
3. **Ảnh:** chốt placeholder (E5) hay chờ ghép pipeline asset của **E1**? Ảnh hưởng thứ tự triển khai.
4. **Preview:** render Markdown→HTML ở client (nhanh, nhưng khác kết quả LaTeX) hay preview bằng PDF
   thật (chậm, tốn compile)? Đề xuất HTML cho preview *soạn thảo*, PDF chỉ khi "Tạo".
5. **`inputFormat` trong data model:** thêm field mới hay suy ra từ đuôi file/lựa chọn UI? Cần thống
   nhất với `DocumentRequest`/`StoredDocument` để không phá tương thích CRUD hiện có.
6. **Có lưu Markdown gốc kèm LaTeX không?** (để sửa lại từ MD). `StoredDocument` hiện chỉ giữ `latex`
   — có nên thêm `sourceMarkdown?` để round-trip?
