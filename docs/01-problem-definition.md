# 01 — Định nghĩa bài toán

## 1.1. Bối cảnh

[LaTeX](https://www.latex-project.org/) là **document preparation system** để typesetting chất lượng
cao, là **chuẩn thực tế (de facto standard)** cho truyền thông tài liệu khoa học/kỹ thuật. Triết lý
cốt lõi: **tách biệt nội dung khỏi trình bày** — tác giả tập trung viết nội dung, hệ thống lo trình bày.

Trích trang chủ LaTeX Project:

> "LaTeX encourages authors not to worry too much about the appearance of their documents
> but to concentrate on getting the right content. […] LaTeX is not a word processor!"

Triết lý "mô tả nội dung, hệ thống lo trình bày" này khiến LaTeX **rất hợp** với sinh tự động bằng AI.

## 1.2. Vấn đề (Pain points)

LaTeX mạnh nhưng **rào cản gia nhập cao**. Tổng hợp từ cộng đồng (tex.stackexchange, researchgate, blog):

1. **Steep learning curve** — lý do được nhắc nhiều nhất.
2. **Không WYSIWYG** — người mới mất phương hướng vì không thấy kết quả ngay.
3. **Khó tìm đúng ký hiệu** — đặc biệt ký hiệu toán học.
4. **Lỗi cú pháp khó debug** — thiếu backslash, sai `{}`, môi trường không đóng; thông báo lỗi TeX khó hiểu.
5. **Layout "bướng bỉnh"** — hình/bảng tự nhảy vị trí, formatting vỡ khi thêm nội dung.
6. **Tài liệu học tập phân cực** — hoặc quá cơ bản, hoặc quá nâng cao.

### Pain points riêng khi dùng AI sinh LaTeX

- AI sinh code **trông đúng nhưng không compile được** (bịa package/option, sai môi trường).
- Người dùng **không đủ kiến thức để tự sửa** lỗi compile → kẹt.
- **Hallucination** đặc thù LaTeX: bịa package, bịa option, bịa BibTeX entry, bịa citation key, bịa cách dùng macro.
- Vòng lặp copy code sang Overleaf để compile thủ công rất mệt.

## 1.3. Phát biểu bài toán (định nghĩa chặt)

Theo nghiên cứu sâu, bài toán **không nên** đóng khung là "dùng LLM viết text LaTeX". Định nghĩa đúng:

> **Từ một yêu cầu ngôn ngữ tự nhiên và/hoặc ngữ cảnh dự án, hệ thống tạo ra mã LaTeX và các tệp
> phụ trợ sao cho đầu ra (1) đúng ngữ nghĩa, (2) biên dịch được, (3) phù hợp template/venue, và
> (4) an toàn khi compile.**

Đây là bài toán **kỹ nghệ tài liệu (document engineering)**, không phải bài toán sinh văn bản thuần.
Tính đúng (correctness) phụ thuộc thêm vào class, package, bib, assets, nhiều vòng compile, và môi
trường thực thi — không chỉ "nói nghe hay".

### Đầu ra là một GÓI ARTIFACT, không chỉ chuỗi `.tex`

Đầu ra nên được coi là **gói artifacts**:

- `main.tex` + các file include
- `.bib` (bibliography), thư mục `assets/`
- **compile logs**, danh sách warning/error
- bản **PDF preview**
- **metadata**: engine (`pdflatex`/`xelatex`/`lualatex`), danh sách package/class đã dùng, template

> Ở **MVP**, gói artifact tối thiểu là `main.tex` + PDF + logs + metadata cơ bản (single-file).
> Multi-file/.bib/assets là mục tiêu v1/v2.

### Ràng buộc

Hợp lệ cú pháp, biên dịch được, nhất quán cấu trúc, tương thích package/class, và **an toàn thực thi**
(kiểm soát shell-escape và các macro có thể gọi chương trình ngoài — xem [07](./07-compile-service.md)).

### Giả định

- Nếu người dùng chưa chỉ định template/venue → mặc định template an toàn, phổ biến (`article`/`report`,
  sau này `beamer`/journal templates).
- Nếu người dùng đã có project/tệp → ưu tiên **"chỉnh sửa bảo toàn phong cách"** hơn là viết lại từ đầu (v1+).

## 1.4. Đối tượng người dùng (Personas)

| Persona                  | Mô tả                                   | Nhu cầu                                           |
| ------------------------ | --------------------------------------- | ------------------------------------------------- |
| **Sinh viên**            | Cần report/bài tập đẹp, chưa biết LaTeX | Tạo report nhanh, không cần học cú pháp           |
| **Nhà nghiên cứu**       | Biết nội dung, ngại cú pháp/venue rules | Sinh khung article chuẩn template, chỉnh nội dung |
| **Người viết Markdown**  | Quen Markdown, muốn chất lượng LaTeX    | Chuyển Markdown → PDF chất lượng LaTeX (v1)       |
| **Người dùng phổ thông** | Cần tài liệu trình bày chuyên nghiệp    | Mô tả bằng lời, nhận PDF đẹp                      |

## 1.5. Phân loại use case (5 cụm chính)

1. **Soạn thảo tài liệu mới** — bài báo, technical report, thesis skeleton, proposal, lab report,
   letter, CV, slide Beamer. _(MVP: article/report; v1+: beamer, thesis, CV...)_
2. **Chuyển đổi định dạng** — Markdown→LaTeX, DOCX→LaTeX, HTML→LaTeX, notebook→LaTeX (qua Pandoc/Quarto).
   Thường dễ thương mại hóa hơn "sinh từ số 0". _(v1)_
3. **Sửa lỗi, tái cấu trúc, tối ưu** — sửa lỗi compile, gợi ý package đúng, đổi engine, giảm warning,
   chuẩn hóa macro/bibliography, đổi class/template mà giữ nội dung. _(một phần ở MVP qua repair loop; mở rộng v1)_
4. **Multimodal & OCR → LaTeX** — ảnh công thức→LaTeX, ảnh bảng→LaTeX, PDF học thuật→markup, viết tay→LaTeX
   (im2latex, pix2tex, Nougat). _(v2)_
5. **Publishing workflow & collaboration** — Git integration, auto-compile CI, preview, comment/diff. _(v2)_

> **Phạm vi MVP** tập trung cụm (1) + một phần (3) (repair loop). Các cụm còn lại định hướng cho v1/v2.

## 1.6. Phân tích thị trường & đối thủ

Bảng dưới trộn **đối thủ trực tiếp** và **công cụ kề cận** ảnh hưởng tới định vị (vì nhiều use case
"AI sinh LaTeX" thực ra cạnh tranh với luồng "không bắt viết LaTeX tay" như Pandoc/Manubot/Quarto).

| Tên                                 | License       | Tech stack                                       | Đặc điểm chính                                             | Trạng thái                                         |
| ----------------------------------- | ------------- | ------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| **Overleaf CE**                     | AGPL-3.0      | Web + Docker + TeX Live                          | Editor cộng tác realtime, preview, self-host               | Mature; rất nhạy về sandbox/security khi self-host |
| **Octree**                          | LGPL-3.0      | Next.js 15, Monaco, Supabase, Anthropic          | AI LaTeX editor có compile + chat                          | Repo active; chưa release                          |
| **Open-Prism**                      | MIT           | Next.js, Hono, TeX Live, CodeMirror, PDF preview | AI writing workspace + live PDF preview                    | Rất sớm/prototype                                  |
| **LMMs-Lab Writer**                 | MIT           | Tauri, TS, Rust                                  | Editor LaTeX desktop, **local-first**, AI-native           | Có release (vd v0.1.3)                             |
| **AI LaTeX Editor**                 | MIT           | React/TS + FastAPI + Celery + Redis              | Sinh/sửa LaTeX, compile sandbox, math/citation helper      | Demo sớm                                           |
| **Pandoc**                          | GPL-2.0       | Haskell                                          | Universal converter Markdown↔LaTeX/PDF                     | Mature                                             |
| **Manubot**                         | BSD-2-Clause+ | Python                                           | Scholarly writing bằng Markdown + Git → PDF/HTML/DOCX      | Mature/stable                                      |
| **Tectonic**                        | MIT           | C + Rust + XeTeX                                 | TeX engine hiện đại, cache, `--untrusted`                  | Mature (engine ta dùng)                            |
| **WaldTeX**                         | MIT           | Node/JS + Quarto                                 | Markdown IDE local-first, xuất PDF bằng LaTeX              | Sớm                                                |
| **OpenAI Prism / TeXGPT / texpert** | —             | —                                                | Editor LaTeX-first AI / plugin Overleaf / Gemini doc maker | Thương mại/sản phẩm                                |

### Khoảng trống & định vị

- Overleaf mạnh collaboration nhưng **không AI-first** và nhạy security khi self-host.
- Các editor AI-native (Octree, Open-Prism...) còn **rất sớm**.
- Pandoc/Manubot/WaldTeX cho thấy đối thủ thật của "AI sinh LaTeX" là luồng **không bắt viết LaTeX tay**.

→ **Định vị của ta: document engineering system bán giá trị ở "document reliability"** (compile được,
sửa lặp được, an toàn khi compile) — **không** định vị hẹp là "chatbot viết `.tex`".

## 1.7. Phạm vi (Scope)

### Trong phạm vi (MVP)

- Input: mô tả ngôn ngữ tự nhiên (text) + chọn **template** (article/report) — _template-first_.
- AI sinh tài liệu LaTeX đầy đủ; **AST validation** trước khi compile.
- Compile server-side bằng **Tectonic** (`--untrusted`) → PDF, kèm logs/metadata.
- Vòng lặp tự sửa lỗi (generate → validate → compile → patch).
- Preview PDF + tải về. Stateless, không auth.

### Ngoài phạm vi MVP — roadmap v1/v2

- RAG (template/package docs/style guide/project memory).
- Markdown→LaTeX (Pandoc), sửa project nhiều file, BibTeX helper.
- OCR ảnh/handwriting → LaTeX; multilingual hạng nhất (CJK/RTL).
- Tài khoản, lưu trữ, collaboration, self-host/local-first.

## 1.8. Tiêu chí thành công

- Người dùng không biết LaTeX vẫn tạo được PDF article/report hợp lệ chỉ từ một đoạn mô tả.
- **Compile success rate** cao (sau AST validation + repair loop) — xem [09-evaluation.md](./09-evaluation.md).
- Output **sửa/lặp lại được** và **an toàn** khi compile (compile trong sandbox).
- Thời gian mô tả → PDF ở mức chấp nhận được cho web (vài giây cho tài liệu nhỏ).
