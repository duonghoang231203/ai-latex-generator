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
| 🔲 | **RAG (Retrieval-Augmented Generation)** | Tích hợp tài liệu tham khảo từ người dùng (Upload file) để AI tạo nội dung chính xác hơn. | |
| 🔲 | **Markdown to LaTeX conversion** | Hỗ trợ chuyển đổi từ định dạng Markdown sang chuẩn LaTeX. | |
| 🔲 | **OCR Integration** | Xử lý và nhận diện hình ảnh/phương trình từ tài liệu đầu vào thành mã LaTeX. | |
| 🔲 | **Multi-file project support** | Hỗ trợ cấu trúc tài liệu đa file phức tạp (Multi-file project). | |
| 🔲 | **Agentic multi-step document assembly** | Lắp ghép tài liệu qua các bước tự động hóa (multi-step assembly). | |

---

## ⚪ Phase 3: Platform Maturity (Kế hoạch tương lai)

| Trạng thái | Tính năng | Mô tả chi tiết |
| :---: | :--- | :--- |
| 🔲 | **Authentication & Database (v2)** | Multi-user Auth (Đăng nhập, phân quyền) & Lưu trữ trên Database (Postgres/Mongo) thay vì local files. |
| 🔲 | **Advanced deployment strategies** | Triển khai trên môi trường Cloud, Dockerization, thiết lập CI/CD pipeline. |

---

> **Chú thích trạng thái:**
> - ✅ `Done`: Hoàn thành
> - 🔄 `In Progress`: Đang xử lý
> - 🔲 `Todo`: Chưa bắt đầu
> - ❌ `Cancelled / Blocked`: Bị hủy hoặc tạm dừng
