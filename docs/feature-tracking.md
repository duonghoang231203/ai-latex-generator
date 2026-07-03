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
| 🔲 | **E1 · Multi-file project support (Core)** | Kiến trúc lưu trữ dạng thư mục (Directory-based storage) phục vụ tài liệu lớn. | Theme: Scale · Ưu tiên **1** (enabler) · Effort L |
| 🔲 | **E5 · Markdown → LaTeX conversion** | Viết nháp bằng định dạng Markdown, tự động chuyển sang chuẩn LaTeX. | Theme: Authoring speed · Ưu tiên **2** (quick win) · Effort S–M |
| 🔲 | **E3 · RAG (Retrieval-Augmented Generation)** | Truy hồi tài liệu tham khảo (upload) để AI viết nội dung chính xác, có trích dẫn nguồn. | Theme: Content accuracy · Ưu tiên **3** · Effort M–L |
| 🔲 | **E2 · Agentic multi-step document assembly** | Cơ chế tạo dàn ý và tự động viết nội dung theo dạng Checklist (Human-in-the-loop). | Theme: Smart assembly · Ưu tiên **4** (sau E1) · Effort L |
| 🔲 | **E4 · OCR công thức Toán/Lý/Hóa** | Nhận diện công thức Toán/Lý/Hóa từ hình ảnh thành mã LaTeX. | Theme: Multimodal input · Ưu tiên **5** · Effort M |

---

## ⚪ Phase 3: Platform Maturity (Kế hoạch tương lai)

| Trạng thái | Tính năng | Mô tả chi tiết |
| :---: | :--- | :--- |
| 🔲 | **Authentication & Database (v2)** | Multi-user Auth (Đăng nhập, phân quyền) & Lưu trữ trên Database (Postgres/Mongo) thay vì local files. |
| 🔲 | **Advanced deployment strategies** | Triển khai trên môi trường Cloud, Dockerization, thiết lập CI/CD pipeline. |

---

## 📋 Task Breakdown (trích xuất từ Roadmap)

Các đầu việc cụ thể được trích xuất từ [`project-roadmap.md`](./project-roadmap.md) cho từng tính năng. Dùng để theo dõi tiến độ chi tiết (đánh dấu `[x]` khi hoàn thành từng đầu việc). Các epic Phase 2 được sắp theo **thứ tự ưu tiên của roadmap: E1 → E5 → E3 → E2 → E4**.

### 🟡 Phase 2 — Advanced Features

#### E1 · Multi-file project support (Core) — *Scale*
- [ ] Thiết kế mô hình lưu trữ dạng thư mục: mỗi tài liệu = 1 folder chứa nhiều file `.tex` + assets (thay cho trường `latex` đơn trong `StoredDocument`).
- [ ] Cập nhật `lib/store/documentStore.ts` sang cấu trúc directory-based (đọc/ghi/liệt kê nhiều file).
- [ ] Mở rộng data model `lib/types/document.ts`: danh sách file, file gốc (root/main), quan hệ `\input`/`\include`.
- [ ] Cập nhật `compile-service` để nhận nhiều file (main + phụ) và biên dịch từ file gốc.
- [ ] UI: cây thư mục / tab file, chọn file gốc để biên dịch.
- [ ] Migration: chuyển tài liệu single-file hiện có sang cấu trúc mới.

#### E5 · Markdown → LaTeX conversion — *Authoring speed*
- [ ] Bộ chuyển Markdown → LaTeX (heading, list, bảng, code, ảnh, công thức `$...$`).
- [ ] Chế độ soạn nháp bằng Markdown trong UI kèm xem trước.
- [ ] Ánh xạ cú pháp Markdown sang template LaTeX đang chọn.
- [ ] Kiểm thử trên các mẫu Markdown phổ biến (đảm bảo compile được).

#### E3 · RAG (Retrieval-Augmented Generation) — *Content accuracy*
- [ ] Ingest tài liệu tham khảo (upload) → tách đoạn (chunking).
- [ ] Sinh embeddings + lưu vào vector store (đánh giá & chọn giải pháp: local vs. dịch vụ).
- [ ] Truy hồi (retrieve) đoạn liên quan theo mô tả người dùng, chèn vào prompt trong `lib/ai/prompts.ts`.
- [ ] Trích dẫn nguồn trong nội dung sinh ra để tăng độ chính xác và khả năng kiểm chứng.
- [ ] Kiểm soát ngân sách token khi nhồi ngữ cảnh (tránh vượt trần request của model).

#### E2 · Agentic multi-step document assembly — *Smart assembly (Human-in-the-loop)*
- [ ] Bước 1: sinh DÀN Ý (outline) và hiển thị dạng checklist cho người dùng duyệt/sửa.
- [ ] Bước 2: tự động viết nội dung theo từng mục trong outline (multi-step), rồi ghép thành tài liệu hoàn chỉnh.
- [ ] Điểm dừng human-in-the-loop: phê duyệt / điều chỉnh giữa các bước.
- [ ] Mở rộng `lib/orchestrator/document.ts` cho quy trình nhiều bước + lưu trạng thái tiến trình.
- [ ] UI: hiển thị tiến trình checklist, chỉnh sửa từng mục (tận dụng `Marker` / chat assistant sẵn có).

#### E4 · OCR công thức Toán/Lý/Hóa — *Multimodal input*
- [ ] Nhận diện CÔNG THỨC (không chỉ text) từ ảnh → mã LaTeX (`amsmath` / `mhchem`).
- [ ] Đánh giá & tích hợp engine OCR công thức (hiện `tesseract.js` trong `lib/extract` chỉ OCR văn bản).
- [ ] Mở rộng `lib/extract` + `app/api/extract` để trả về LaTeX công thức.
- [ ] Cho người dùng review / sửa công thức nhận diện trước khi chèn vào tài liệu.

### ⚪ Phase 3 — Platform Maturity

#### Authentication & Database (v2)
- [ ] Multi-user Auth: đăng nhập, quản lý phiên, phân quyền.
- [ ] Chuyển lưu trữ từ file-based (`DATA_DIR`) sang Database (Postgres hoặc Mongo).
- [ ] Tách dữ liệu theo người dùng (ownership / authorization).
- [ ] Lớp migration dữ liệu từ file-based sang DB.

#### Advanced deployment strategies
- [ ] Hoàn thiện Dockerization (đã có `Dockerfile`, `docker-compose.yml`, `Caddyfile`).
- [ ] Thiết lập CI/CD pipeline (build + lint + test + deploy).
- [ ] Triển khai Cloud + cấu hình TLS/domain qua Caddy cho production.
- [ ] Healthcheck / logging / observability cho môi trường production.

---

> **Chú thích trạng thái:**
> - ✅ `Done`: Hoàn thành
> - 🔄 `In Progress`: Đang xử lý
> - 🔲 `Todo`: Chưa bắt đầu
> - ❌ `Cancelled / Blocked`: Bị hủy hoặc tạm dừng
