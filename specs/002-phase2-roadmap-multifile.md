# Tóm tắt & Thiết kế Roadmap Phase 2 (Multi-file & Agentic Assembly)

Dựa trên quá trình trao đổi, chúng ta đã thống nhất chiến lược phát triển cho Phase 2 của dự án AI LaTeX Generator. Trọng tâm của Phase 2 sẽ là **Xử lý tài liệu lớn (Long-form Documents)**, làm nền móng vững chắc trước khi tiến tới xử lý dữ liệu đầu vào.

## 1. Lộ trình Phase 2 (Cập nhật)

Thứ tự triển khai (Sequencing) được chốt như sau:

1. **Multi-file Storage (Core Architecture)**
2. **Agentic Checklist UX (Human-in-the-loop Assembly)**
3. **RAG (Reference Material Integration)**
4. **OCR (Images/Equations Processing)**
5. **Markdown to LaTeX Conversion**

## 2. Thiết kế Kiến trúc cho Multi-file & Agentic

### 2.1 Cấu trúc Lưu trữ (Storage)
- **Directory-Based Storage:** Thay vì lưu các file đơn lẻ, mỗi `Document` sẽ là một thư mục (Directory) riêng trong `DATA_DIR` (ví dụ: `DATA_DIR/{document_id}/`).
- Thư mục này sẽ chứa `main.tex` (file gốc) và các file `.tex` phụ (ví dụ: `chapter1.tex`, `chapter2.tex`), thư mục `images/`, và cấu hình `metadata.json`.
- Hệ thống Mount trực tiếp toàn bộ thư mục này vào Tectonic Docker Sandbox, giúp quá trình biên dịch (compile) diễn ra trơn tru mà không cần ghép file thủ công.

### 2.2 Trải nghiệm Người dùng (Agentic Assembly UX)
- Áp dụng mô hình **Human-in-the-loop Orchestrator**.
- Khởi tạo: Người dùng nhập yêu cầu viết một tài liệu lớn (ví dụ: "Viết luận văn về AI").
- Bước 1: AI sinh ra một Dàn ý (Outline) và danh sách các file tương ứng (`main.tex`, `chapter1.tex`, ...).
- Bước 2: UI hiển thị dàn ý này dưới dạng Checklist/Board. Người dùng có thể chỉnh sửa cấu trúc dàn ý.
- Bước 3: Người dùng bấm "Generate All" hoặc tạo từng phần. Hệ thống sẽ gọi AI để viết chi tiết cho từng file dựa trên dàn ý tổng thể.

### 2.3 Cơ chế Auto-Repair cho Multi-file
- Áp dụng cơ chế **Targeted Repair (Sửa lỗi có mục tiêu)**.
- Khi Tectonic báo lỗi, backend sẽ phân tích `stdout`/`stderr` log để xác định chính xác LỖI xảy ra ở file nào và dòng nào.
- Hệ thống chỉ trích xuất file bị hỏng đó + một phần preamble của `main.tex` để làm context gửi cho AI sửa.
- Việc này giúp tiết kiệm tối đa Token, tránh lỗi tràn bộ nhớ ngữ cảnh (context window) và giúp AI tập trung sửa đúng chỗ hỏng.

## 3. Các bước triển khai tiếp theo (Implementation Next Steps)
- Cập nhật API tạo Document (`POST /api/documents`) để hỗ trợ tạo Directory thay vì file đơn.
- Cập nhật hàm gọi Tectonic để map volume theo dạng thư mục.
- Xây dựng UI mới (Checklist/Sidebar) để hiển thị cấu trúc đa file.
- Viết prompt cho AI sinh Dàn ý và prompt sinh nội dung từng phần.
- Viết hàm Parser Regex để đọc lỗi của Tectonic và match với file cụ thể.
