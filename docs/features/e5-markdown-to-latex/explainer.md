# Giải thích sâu — E5 · Markdown → LaTeX

> Ngày: 2026-07-09 · Theme: **Authoring speed** · Ưu tiên roadmap: **2 (quick win)**
> Loại: **tài liệu giải thích dễ đọc** (đọc để *hiểu bản chất*, không phải checklist).
> Bám sát ĐÚNG code đã viết trong repo (xem `lib/markdown/`, `lib/orchestrator/document.ts`,
> `lib/templates/registry.ts`). Xem thêm: [`research.md`](./research.md) (khảo sát giải pháp) và
> [`plan.md`](./plan.md) (checklist đầu việc).

Tài liệu này giải thích E5 theo cùng một khung với E3 để dễ đối chiếu:
**(1) phân tích vấn đề → (2) các giải pháp & vì sao chọn → (3) cách code thực sự chạy →
(4) cạm bẫy → (5) câu hỏi liên quan.**

> **Điểm nối với vụ quota/429:** E5 gần như **không tốn token AI**. Bước dịch Markdown→LaTeX là
> **tất định** (chạy offline, $0 token); AI chỉ được gọi ở *repair loop* khi LaTeX không compile
> được — và khi đó nó bị cấm thêm nội dung. Nên bật E5 không làm quota AI tệ hơn.

---

## 1. Phân tích vấn đề

Câu hỏi gốc: *người dùng đã quen viết Markdown, tại sao bắt họ mô tả bằng lời rồi chờ AI đoán cấu
trúc?*

Điểm mấu chốt để phân tích đúng: người viết Markdown kỳ vọng **giữ nguyên cấu trúc họ viết** (tiêu
đề nào ra `\section` đó, bảng ra bảng). Kỳ vọng này **ngược** với luồng generate-from-description
hiện có — vốn *chủ động mở rộng* nội dung (nhìn `buildUserPrompt` trong `lib/ai/prompts.ts`: có câu
"nếu mô tả ngắn/chung chung, hãy **CHỦ ĐỘNG mở rộng hợp lý**").

→ Nhận ra bản chất bài toán chỉ là **"dịch cú pháp có cấu trúc"**, không phải "suy luận nội dung".
Đây là địa hạt của **trình biên dịch tất định**, không phải LLM.

Một phát hiện quan trọng khác: hạ tầng *đọc* Markdown **đã có sẵn** — `classify()` trong
`lib/extract/extract.ts` coi `.md`/`.markdown` là `text`. Cái còn thiếu chỉ là (a) bước *chuyển cú
pháp* MD→LaTeX giữ cấu trúc, và (b) chỗ *khai báo input là Markdown* trong data model + UI. Đây là
feature *bổ sung một bước biến đổi*, không phải đại phẫu.

---

## 2. Các giải pháp & vì sao chọn

Có hai triết lý (chi tiết ở [`research.md §3–4`](./research.md)):

| | A — "Để AI làm" | B — Converter tất định |
|---|---|---|
| Cách làm | Thêm prompt "đây là Markdown, chuyển sang LaTeX" | Parse Markdown → phát LaTeX theo luật cố định |
| Ưu | ~0 code | Tất định, offline, **$0 token**, test được (snapshot), giữ đúng cấu trúc |
| Nhược | Không tất định (cùng input → output khác nhau), tốn token/latency, dễ "chế thêm", khó test | Phải tự lo edge case (phần đuôi dài) |

**Quyết định: B làm lõi, A làm lưới an toàn.** Converter tất định xử lý ~80% cú pháp phổ biến; phần
hiếm/lỗi thì rơi vào `runRepairLoop` — nơi AI **chỉ sửa để compile được**, bị cấm thêm nội dung
(SYSTEM_PROMPT: "giữ nguyên ý đồ nội dung và template").

**Về thư viện parser:** loại **Pandoc** (là binary hệ thống, đi ngược tinh thần no-shell của
sandbox). Chọn **`markdown-it`** (pure-JS, token stream, dễ override rule) thay vì `unified/remark`
(AST sạch hơn nhưng nặng tay hơn cho việc này). Bằng chứng trong code: `lib/markdown/markdown-parser.ts`
khởi tạo `new MarkdownIt({ html: false, linkify: false, typographer: false })` — cấu hình tất định để
output ổn định, dễ test snapshot.

---

## 3. Cách code thực sự chạy (pipeline)

Luồng khi bật chế độ Markdown và bấm "Tạo":

```
ChatAssistant / GeneratorForm (inputFormat = "markdown")
   │  POST /api/documents  { inputFormat, markdown, template }
   ▼
app/api/documents/route.ts :: runByFormat
   │   inputFormat === "markdown" → runDocumentFromMarkdown   ← rẽ nhánh, KHÔNG đụng luồng cũ
   │   ngược lại                  → runDocument               ← đường generate-from-description
   ▼
lib/orchestrator/document.ts :: runDocumentFromMarkdown
   ├─ [1] convertMarkdownToLatexBody(markdown, { documentClass })  → { body, requiredPackages, warnings }
   ├─ [2] wrapBodyInTemplate(template, body, requiredPackages)     → tài liệu LaTeX đầy đủ (preamble)
   └─ [3] runRepairLoop(fullLatex, regenerate, …)                  → validate → compile → (AI vá)
   ▼
DocumentResult (kèm warnings converter để UI hiển thị)
```

`documentClass` lấy từ template đang chọn (`getTemplate(template)?.documentClass ?? "article"`) —
đây là thứ quyết định heading ánh xạ ra `\chapter` hay `\section`.

Các file trong `lib/markdown/` và vai trò thật của chúng:

- **`markdown-parser.ts`** — bọc `markdown-it`: parse Markdown → token stream. Còn **đăng ký rule
  `math`** (xem cạm bẫy #1).
- **`latex-emitter.ts`** (BLOCK) — hàm `renderRange()` duyệt token cấp khối: heading, đoạn văn, list
  (lồng, đệ quy qua `renderListItems`), bảng GFM (`renderTable` → `tabular` + `booktabs`), code fence
  (→ `listings`), blockquote (→ `quote`), hr (→ `\hrulefill`). Heading ánh xạ theo `documentClass` qua
  `headingCommand()`: class `report` → `# → \chapter`; các class khác (article-based) → `# → \section`.
- **`inline-emitter.ts`** (INLINE) — hàm `renderInline()` xử lý nội dung trong dòng:
  `**đậm**`→`\textbf{}`, `*nghiêng*`→`\emph{}`, `~~gạch~~`→`\sout{}` (gói `ulem`),
  `` `code` ``→`\texttt{}`, `[x](url)`→`\href{}{}` (gói `hyperref`), ảnh→placeholder, và token toán.
- **`latex-escape.ts`** — `escapeLatexText()` escape ký tự đặc biệt (`& % $ # _ { } ~ ^ \`) cho **vùng
  văn bản thường**.
- **`emit-context.ts`** — object `EmitContext` đi theo suốt quá trình phát, gom `packages` (gói phát
  sinh) + `warnings`, và giữ `documentClass`.
- **`markdown-to-latex.ts`** — hàm `convertMarkdownToLatexBody()` ghép mọi thứ, trả
  `{ body, requiredPackages, warnings }`.

**Điểm thiết kế hay:** `wrapBodyInTemplate()` trong `lib/templates/registry.ts` là **NGUỒN PREAMBLE
DUY NHẤT**. Converter chỉ phát *thân* (body); preamble (documentclass + gói) lấy từ template — nên
không bị "trôi" (drift) khỏi luồng generate. Gói phát sinh (`listings`, `booktabs`, `hyperref`,
`amsmath`, `ulem`...) được merge + dedupe với `packages` của template.

---

## 4. Cạm bẫy & cách xử lý (phần "thực sự hiểu")

**Cạm bẫy #1 — Math bị hỏng (quan trọng nhất).** `markdown-it` mặc định coi `$` là ký tự thường và
**"unescape" các dấu backslash** trong lúc tokenize. Nên `$x^2\,dx$` bị nó biến `\,` → `,` → LaTeX
toán hỏng.

Cách xử lý (trong `markdown-parser.ts`): **đăng ký một inline rule `math` chạy TRƯỚC rule `escape`**
của markdown-it:
```ts
md.inline.ruler.before("escape", "math", mathInlineRule);
```
`mathInlineRule` "nuốt" trọn `$...$` / `$$...$$` thành một token riêng (`math_inline` /
`math_block_inline`) với **nội dung raw**, nên markdown-it không kịp đụng vào backslash bên trong.
Sau đó `inline-emitter.ts` phát `$...$` (giữ nguyên) hoặc `\[...\]` (display) và thêm gói `amsmath`.
Bài học tổng quát: *thứ tự các rule* trong markdown-it quyết định đúng/sai.

> Lưu ý: `inline-emitter.ts` còn có `emitTextWithMath()` — quét `$...$`/`$$...$$` ngay trong vùng
> `text` như một lớp phòng vệ thứ hai, để nếu math lọt xuống dạng text thường thì vẫn được
> passthrough thay vì bị escape.

**Cạm bẫy #2 — Escape sai vùng.** Phải phân biệt vùng *text* (cần escape `& % $ # _ { } ~ ^ \`) với
vùng *math/code* (không escape). Trong emitter, math được passthrough, code đi qua `escapeInlineCode`
/ `listings`, chỉ còn text đi qua `escapeLatexText`. Bản thân `escapeLatexText` xử lý **backslash
trước** (dùng placeholder tạm `\u0000BACKSLASH\u0000`) để không escape chồng lên các dấu `\` do chính
nó sinh ra.

**Cạm bẫy #3 — Ràng buộc sandbox.** Compile chạy Tectonic `--untrusted`, không shell-escape, không
file ngoài. Nên converter phải:
- Code block → `listings` (**KHÔNG** `minted` vì minted cần `-shell-escape`). Xem `emitCodeBlock()` —
  cố tình không đặt `language=` để tránh lỗi "Couldn't load requested language".
- Ảnh `![alt](url)` → **không** `\includegraphics` (sandbox không có file), mà thành `\fbox{alt}` +
  đẩy một `warning` cho người dùng.
- HTML nhúng → `html:false` khiến markdown-it coi nó là text thường (an toàn, không thực thi); block
  `html_block` / `html_inline` bị bỏ qua khi emit.

---

## 5. Câu hỏi liên quan (E5)

- **Tại sao không để AI làm hết cho gọn?** Vì mất tính tất định (không test được, không lặp lại
  được), tốn token, và phá kỳ vọng "giữ nguyên cấu trúc". Converter tất định né được cả ba.
- **Repair loop có "chế thêm" nội dung không?** Không. Lượt sửa dùng `errorContext`
  (`previousLatex` + `errorLog`), và `buildUserPrompt` (nhánh `errorContext`) yêu cầu "giữ nguyên ý đồ
  nội dung và template". Nó chỉ sửa để compile được.
- **Heading → `\chapter` quyết định thế nào?** Theo `documentClass` của template: class `report` →
  có `\chapter`; các class article-based → chỉ `\section` trở xuống. Logic ở `headingCommand()` trong
  `latex-emitter.ts`.
- **Nếu cú pháp Markdown lạ (footnote, definition list...)?** Converter phủ GFM core (bảng,
  strikethrough) + math; phần lạ hoặc bỏ qua an toàn hoặc để repair loop lo. Đó là lý do có lưới an
  toàn.
- **`sourceMarkdown` lưu để làm gì?** Để round-trip (sửa lại từ Markdown gốc). Đã lưu trong
  `StoredDocument` (`lib/types/document.ts`) và ghi bởi `route.ts` khi tạo từ Markdown.
- **Cờ bật/tắt?** `MARKDOWN_INPUT_ENABLED` (mặc định `true`) trong `lib/config.ts` để rollout an toàn.
