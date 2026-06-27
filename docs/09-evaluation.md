# 09 — Đánh giá, bộ test mẫu & metrics

Tiêu chí đánh giá được xếp theo **thứ tự ưu tiên vận hành**, không theo thói quen NLP thuần văn bản.
Với sản phẩm này, "compile được" quan trọng hơn "điểm overlap text cao".

## 9.1. Tiêu chí đánh giá (theo thứ tự ưu tiên)

### 1. Syntactic validity (tính hợp lệ cú pháp)
Đầu ra có **parse được** bởi parser thực dụng không, cấu trúc môi trường/cặp lệnh có đúng không.
- Công cụ: tree-sitter-latex, latex-utensils.
- Đo: **parse-pass rate**, số lỗi cấu trúc phát hiện trước compile.
- Là lớp kiểm **rẻ**, chạy trước compile.

### 2. Compilability to PDF (khả năng biên dịch) — **metric quan trọng nhất**
Một mẫu "nghe hợp lý" nhưng không compile thì gần như **thất bại** với người dùng.
- Đo: **compile success rate**, số vòng rerun, số warning/error còn lại, **tỷ lệ cần human intervention**,
  và **attempts** trung bình (số lần qua repair loop để ra PDF).
- Công cụ: Tectonic / latexmk.

### 3. Semantic fidelity (trung thực ngữ nghĩa) — 2 lớp
- Fidelity với **prompt/tài liệu nguồn** (nội dung đúng yêu cầu).
- Fidelity với **template/style rules** (đúng cấu trúc venue).
- Với tác vụ conversion/OCR: BLEU/ROUGE chỉ là **chỉ báo phụ** (nhiều chuỗi LaTeX khác nhau cho cùng
  một hiển thị). Nên thêm metric cấu trúc/hình ảnh như **TEDS-Structure**, **CW-SSIM** (table/image-to-LaTeX).

### 4. Human evaluation (đánh giá người) — bắt buộc, ≥ 3 trục
- Tính đúng học thuật/ngữ nghĩa.
- Tính **dễ sửa tiếp** (maintainability).
- Tính chấp nhận được của **chất lượng typographic**.
- Chấm theo **rubric**, không chỉ dựa overlap.

### 5. Security evaluation (đánh giá bảo mật) — test suite riêng
Ngang hàng compilability, không phải "thêm cho có".
- Cấm shell-escape; phát hiện lệnh nguy hiểm (`\write18`...).
- Cô lập filesystem/network.
- Thử các mẫu exploit đã biết (kể cả LuaTeX shell-exec).

## 9.2. Bộ test mẫu (8 ca, dùng được cho CI/benchmark nội bộ)

> Ở **MVP**, ca trọng tâm là **1, 2, 5** (article, công thức, sửa lỗi compile). Các ca 3, 4, 6, 7, 8
> phục vụ v1/v2 (Beamer, Markdown→LaTeX, multilingual/engine, OCR, project editing) nhưng nên đưa vào
> benchmark sớm để theo dõi tiến bộ.

| # | Test case | Input prompt | Tiêu chí output | Pass | Fail |
|---|-----------|--------------|-----------------|------|------|
| 1 | **Bài báo cơ bản** | "Tạo bài báo khoa học 2 trang tiếng Việt về ứng dụng AI trong chẩn đoán ảnh y khoa, có abstract, 3 section, 5 citation placeholder." | Có `\documentclass`, `\begin{document}`, title/author/abstract, sectioning rõ, citation placeholder hợp lệ, hỗ trợ tiếng Việt/Unicode | Parse pass; compile pass; abstract + 3 section xuất hiện; không lỗi fatal | Không compile; ký tự tiếng Việt hỏng; thiếu abstract/section |
| 2 | **Công thức toán** | "Viết chứng minh ngắn cho khai triển Taylor của `e^x`, có công thức hiển thị và căn chỉnh nhiều dòng." | Dùng `align`/`equation`, đóng/mở môi trường đúng, không lạm dụng text mode | Parse pass; compile pass; công thức căn chỉnh đúng; không unclosed math mode | Lỗi math mode; môi trường sai; compile fail |
| 3 | **Slide Beamer** *(v1+)* | "Tạo 6 slide Beamer giới thiệu RAG cho kỹ sư backend." | Class `beamer`, title slide, outline, các frame ngắn gọn | Compile pass; ≥ 5 frame; bố cục đọc được; không overflow nghiêm trọng | Dùng nhầm `article`; frame lỗi; compile fail |
| 4 | **Markdown → LaTeX** *(v1)* | File Markdown có heading, bảng, list, code block, citations | Chuyển sang LaTeX, giữ cấu trúc mục, bảng/citation hợp lệ, code block hiển thị | Heading tương ứng; compile pass; bảng không vỡ; citation map đúng | Mất sectioning; bảng lỗi; citation đứt; compile fail |
| 5 | **Sửa lỗi compile** | Project `.tex` thiếu `\end{table}` + package conflict mô phỏng | Xác định lỗi, patch ngắn nhất, giữ nội dung không liên quan | Sau patch: compile pass; diff tối thiểu; warning giảm | Sửa lan man; lỗi mới; compile vẫn fail |
| 6 | **Tối ưu package/engine** *(v2)* | "Tài liệu có tiếng Nhật, tiếng Ả Rập và công thức; chọn engine và package tối thiểu hợp lý." | Chọn XeLaTeX/LuaLaTeX, package tối thiểu, giải thích lý do | Compile pass với Unicode đa ngôn ngữ; package không dư thừa; không cấu hình mâu thuẫn | Chọn `pdflatex` không xử lý Unicode; compile fail; package xung đột |
| 7 | **OCR công thức** *(v2)* | Ảnh công thức / "chuyển ảnh công thức này sang LaTeX" | LaTeX tái tạo công thức, render đúng hình thức cơ bản | Render toán gần đúng; compile pass; human judge chấp nhận | Ký hiệu sai trọng yếu; compile fail; render sai ngữ nghĩa |
| 8 | **Chỉnh sửa project có sẵn** *(v1)* | Repo có `main.tex`, `.bib`, figures; "thêm Related Work theo phong cách hiện tại, không đổi template." | Chỉ thêm section cần thiết; giữ class/package/citation style/formatting | Diff cục bộ; compile pass; style nhất quán; không đổi ngoài phạm vi | Reformat toàn file; đổi class/package vô cớ; compile fail |

## 9.3. Metrics tổng hợp (dashboard — v1)

| Metric | Mô tả | Mục tiêu |
|--------|-------|----------|
| Parse-pass rate | % output qua AST validation | Cao |
| Compile success rate (final) | % ra PDF sau repair loop | Cao (ưu tiên #1) |
| Compile success rate (first try) | % ra PDF ngay lần đầu | Theo dõi cải thiện prompt/template |
| Avg attempts | Số lần generate/compile trung bình để thành công | Thấp |
| Human-intervention rate | % tài liệu cần người sửa tay | Thấp |
| Security test pass | % ca security suite pass | 100% (bắt buộc) |
| Latency (small doc) | Thời gian mô tả → PDF tài liệu nhỏ | Vài giây |

## 9.4. Quy trình đánh giá

- **CI regression**: mỗi khi đổi model/prompt/template, chạy bộ 8 ca + security suite; cảnh báo nếu
  compile success rate hoặc security pass giảm.
- **Visual diff** *(v2)*: so PDF render giữa các phiên bản để bắt regression hình thức.
- **A/B prompt/template**: đo first-try compile rate và avg attempts để chọn cấu hình tốt hơn.
- Hầu hết test dùng `MockProvider` để không tốn tiền; ca dùng provider thật chạy giới hạn (smoke).
