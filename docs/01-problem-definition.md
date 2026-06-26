# 01 — Định nghĩa bài toán

## 1.1. Bối cảnh

[LaTeX](https://www.latex-project.org/) là một **document preparation system** dùng để
typesetting (sắp chữ) chất lượng cao, chủ yếu cho tài liệu kỹ thuật và khoa học.
Triết lý cốt lõi của LaTeX là **tách biệt nội dung khỏi trình bày**: tác giả tập trung
viết nội dung, còn việc trình bày/định dạng do hệ thống lo.

Trích từ trang chủ LaTeX Project:
> "LaTeX encourages authors not to worry too much about the appearance of their documents
> but to concentrate on getting the right content. […] LaTeX is not a word processor!"

Chính triết lý "mô tả nội dung, hệ thống lo trình bày" này khiến LaTeX **rất hợp** với mô hình
sinh tự động bằng AI: người dùng mô tả họ muốn gì, AI sinh ra cấu trúc LaTeX đúng chuẩn.

## 1.2. Vấn đề (Pain points)

LaTeX mạnh nhưng có **rào cản gia nhập cao**. Tổng hợp từ cộng đồng (tex.stackexchange,
researchgate, các blog kỹ thuật):

1. **Steep learning curve** — lý do được nhắc đến nhiều nhất khi nói về LaTeX.
2. **Không WYSIWYG** — người mới mất phương hướng vì không thấy kết quả ngay khi gõ
   (khác hẳn Word/Google Docs).
3. **Khó tìm đúng ký hiệu** — đặc biệt là ký hiệu toán học, cần tra cứu liên tục.
4. **Lỗi cú pháp khó debug** — thiếu backslash, sai dấu ngoặc `{}`, môi trường
   (`\begin{...}`) không đóng; thông báo lỗi của TeX khó hiểu với người mới.
5. **Layout "bướng bỉnh"** — hình ảnh/bảng tự "nhảy" vị trí, formatting vỡ khi thêm nội dung.
6. **Tài liệu học tập phân cực** — hoặc quá cơ bản, hoặc quá nâng cao, thiếu phần giữa.

### Vấn đề riêng khi dùng AI sinh LaTeX
Khi đã dùng AI (ChatGPT, Gemini...) để sinh LaTeX, người dùng vẫn gặp:
- AI sinh code **trông đúng nhưng không compile được** (thiếu package, sai môi trường).
- Người dùng **không đủ kiến thức LaTeX để tự sửa** lỗi compile → kẹt.
- Phải copy code qua công cụ khác (Overleaf) để compile, vòng lặp thủ công mệt mỏi.

## 1.3. Phát biểu bài toán

> **Xây dựng một web app cho phép người dùng mô tả tài liệu bằng ngôn ngữ tự nhiên,
> AI sinh mã LaTeX cho tài liệu đầy đủ (article/report), hệ thống tự compile ra PDF
> ngay trong app; nếu compile lỗi, hệ thống tự đưa log lỗi cho AI sửa lại đến khi
> ra được PDF hợp lệ.**

Mục tiêu: xoá bỏ hai rào cản lớn nhất — *phải biết cú pháp LaTeX* và *phải tự debug lỗi compile* —
để bất kỳ ai cũng tạo được tài liệu khoa học chất lượng cao.

## 1.4. Đối tượng người dùng (Personas)

| Persona | Mô tả | Nhu cầu |
|---------|-------|---------|
| **Sinh viên** | Cần nộp báo cáo/bài tập đẹp nhưng chưa biết LaTeX | Tạo report nhanh, không cần học cú pháp |
| **Nhà nghiên cứu mới** | Biết nội dung khoa học, ngại cú pháp LaTeX | Sinh khung article chuẩn, chỉnh nội dung |
| **Người dùng phổ thông** | Cần tài liệu trình bày chuyên nghiệp | Mô tả bằng lời, nhận PDF đẹp |

## 1.5. Phân tích thị trường (sản phẩm tương tự)

| Sản phẩm | Cách tiếp cận | Khác biệt của ta |
|----------|---------------|------------------|
| **OpenAI Prism** | Editor LaTeX-first, AI-native, viết + compile + collaborate | Ta tập trung sinh-tự-động từ NL, đơn giản hơn cho người không rành LaTeX |
| **TeXGPT (Writefull)** | Plugin trong Overleaf, sinh bảng/công thức/figure | Ta là app độc lập, sinh cả tài liệu, có compile + tự sửa |
| **AutoLatex** (Chrome ext) | NL + ảnh → markdown/LaTeX, render tức thì | Ta compile ra PDF thật, không chỉ render snippet |
| **texpert** (Gemini) | Tạo document không cần học cú pháp | Ta thêm vòng lặp tự sửa lỗi compile |
| **Mathpix** | OCR ảnh/handwriting → LaTeX | Khác phạm vi (MVP của ta là text → document) |

**Khoảng trống ta nhắm tới:** kết hợp *sinh tài liệu đầy đủ từ ngôn ngữ tự nhiên* +
*compile PDF thật* + *tự sửa lỗi compile* trong một luồng liền mạch, stateless, dễ dùng.

## 1.6. Phạm vi (Scope)

### Trong phạm vi (MVP)
- Input: mô tả bằng ngôn ngữ tự nhiên (text) + chọn loại tài liệu (**article** / **report**).
- AI sinh tài liệu LaTeX đầy đủ.
- Compile server-side bằng **Tectonic** → PDF.
- Vòng lặp tự sửa lỗi compile (AI repair loop).
- Preview PDF trong trình duyệt + tải về.
- Không cần đăng nhập, không lưu trữ (stateless).

### Ngoài phạm vi (MVP) — để lại cho sau
- Tài khoản người dùng, lưu lịch sử tài liệu.
- Loại tài liệu khác: Beamer slides, letter, CV, book...
- OCR ảnh/handwriting → LaTeX.
- Cộng tác thời gian thực, editor LaTeX đầy đủ.
- Export trực tiếp sang Overleaf.

## 1.7. Tiêu chí thành công

- Người dùng không biết LaTeX vẫn tạo được PDF article/report hợp lệ chỉ từ một đoạn mô tả.
- Tỷ lệ tài liệu compile thành công (sau repair loop) cao (mục tiêu định tính: "hầu hết").
- Thời gian từ mô tả → PDF ở mức chấp nhận được cho trải nghiệm web.
